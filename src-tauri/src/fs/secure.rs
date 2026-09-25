use std::fmt;
use std::fs::File;
use std::io::Read;
use std::os::unix::ffi::OsStrExt;
use std::os::unix::fs::MetadataExt;
use std::path::{Component, Path};

use rustix::fs::{self, AtFlags, Dir, FileType, Mode, OFlags};
use rustix::io::Errno;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum EntryKind {
    File,
    Directory,
    Symlink,
    Other,
    Unknown,
}

#[derive(Debug)]
pub(crate) enum SecureError {
    NotFound,
    Symlink,
    NotDirectory,
    NotRegular,
    Unsupported,
    Invalid,
    AlreadyExists,
    Message(String),
}

impl fmt::Display for SecureError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::NotFound => formatter.write_str("path not found"),
            Self::Symlink => formatter.write_str("path contains a symbolic link"),
            Self::NotDirectory => formatter.write_str("path is not a directory"),
            Self::NotRegular => formatter.write_str("path is not a regular file"),
            Self::Unsupported => formatter.write_str("secure filesystem operation is unsupported"),
            Self::Invalid => formatter.write_str("invalid path"),
            Self::AlreadyExists => formatter.write_str("destination already exists"),
            Self::Message(message) => formatter.write_str(message),
        }
    }
}

fn from_errno(operation: &'static str, error: Errno) -> SecureError {
    match error {
        Errno::NOENT => SecureError::NotFound,
        Errno::LOOP => SecureError::Symlink,
        Errno::NOTDIR => SecureError::NotDirectory,
        Errno::OPNOTSUPP | Errno::NOSYS => SecureError::Unsupported,
        _ => SecureError::Message(format!("{operation}: {error}")),
    }
}

fn from_io(operation: &'static str, error: std::io::Error) -> SecureError {
    error
        .raw_os_error()
        .map(|code| from_errno(operation, Errno::from_raw_os_error(code)))
        .unwrap_or_else(|| SecureError::Message(format!("{operation}: {error}")))
}

fn entry_kind(file_type: FileType) -> EntryKind {
    match file_type {
        FileType::RegularFile => EntryKind::File,
        FileType::Directory => EntryKind::Directory,
        FileType::Symlink => EntryKind::Symlink,
        FileType::Unknown => EntryKind::Unknown,
        _ => EntryKind::Other,
    }
}

fn file_kind(file: &File) -> Result<EntryKind, SecureError> {
    let metadata = file
        .metadata()
        .map_err(|error| from_io("stat file handle", error))?;
    let file_type = metadata.file_type();
    if file_type.is_file() {
        Ok(EntryKind::File)
    } else if file_type.is_dir() {
        Ok(EntryKind::Directory)
    } else if file_type.is_symlink() {
        Ok(EntryKind::Symlink)
    } else {
        Ok(EntryKind::Other)
    }
}

fn directory_flags() -> OFlags {
    OFlags::RDONLY | OFlags::DIRECTORY | OFlags::CLOEXEC | OFlags::NOFOLLOW
}

fn file_flags() -> OFlags {
    OFlags::RDONLY | OFlags::CLOEXEC | OFlags::NOFOLLOW | OFlags::NONBLOCK
}

pub(crate) fn open_anchor_dir(path: &Path) -> Result<File, SecureError> {
    let fd = fs::open(
        path,
        OFlags::RDONLY | OFlags::DIRECTORY | OFlags::CLOEXEC,
        Mode::empty(),
    )
    .map_err(|error| from_errno("open directory", error))?;
    let file = File::from(fd);
    if file_kind(&file)? != EntryKind::Directory {
        return Err(SecureError::NotDirectory);
    }
    Ok(file)
}

pub(crate) fn open_dir_path(path: &Path) -> Result<File, SecureError> {
    let mut directory = if path.is_absolute() {
        let fd = fs::open(
            Path::new("/"),
            OFlags::RDONLY | OFlags::DIRECTORY | OFlags::CLOEXEC,
            Mode::empty(),
        )
        .map_err(|error| from_errno("open filesystem root", error))?;
        File::from(fd)
    } else {
        let fd = fs::open(
            Path::new("."),
            OFlags::RDONLY | OFlags::DIRECTORY | OFlags::CLOEXEC,
            Mode::empty(),
        )
        .map_err(|error| from_errno("open current directory", error))?;
        File::from(fd)
    };

    for component in path.components() {
        let name = match component {
            Component::Normal(name) => name,
            Component::RootDir | Component::CurDir => continue,
            Component::ParentDir => return Err(SecureError::Invalid),
            _ => return Err(SecureError::Invalid),
        };
        let fd = fs::openat(&directory, name, directory_flags(), Mode::empty())
            .map_err(|error| from_errno("open directory component", error))?;
        directory = File::from(fd);
    }

    if file_kind(&directory)? != EntryKind::Directory {
        return Err(SecureError::NotDirectory);
    }
    Ok(directory)
}

pub(crate) fn directory_contains(
    directory: &Path,
    destination_parent: &Path,
) -> Result<Option<bool>, SecureError> {
    let source = match open_dir_path(directory) {
        Ok(source) => source,
        Err(SecureError::NotDirectory) => return Ok(None),
        Err(error) => return Err(error),
    };
    let mut current = open_dir_path(destination_parent)?;
    let source_id = file_id(&source)?;
    let start_id = file_id(&current)?;
    if source_id == start_id {
        return Ok(Some(true));
    }
    loop {
        let current_id = file_id(&current)?;
        let next = fs::openat(
            &current,
            std::ffi::OsStr::new(".."),
            directory_flags(),
            Mode::empty(),
        )
        .map_err(|error| from_errno("open parent directory handle", error))?;
        let next = File::from(next);
        let next_id = file_id(&next)?;
        if next_id == source_id {
            return Ok(Some(true));
        }
        if next_id == start_id || next_id == current_id {
            return Ok(Some(false));
        }
        current = next;
    }
}

fn file_id(file: &File) -> Result<(u64, u64), SecureError> {
    let metadata = file
        .metadata()
        .map_err(|error| from_io("stat directory handle", error))?;
    Ok((metadata.dev(), metadata.ino()))
}

pub(crate) fn open_child_dir(
    parent: &File,
    name: &std::ffi::OsStr,
) -> Result<Option<File>, SecureError> {
    let fd = match fs::openat(parent, name, directory_flags(), Mode::empty()) {
        Ok(fd) => fd,
        Err(Errno::NOENT) => return Ok(None),
        Err(error) => return Err(from_errno("open child directory", error)),
    };
    let file = File::from(fd);
    match file_kind(&file)? {
        EntryKind::Directory => Ok(Some(file)),
        EntryKind::Symlink => Err(SecureError::Symlink),
        _ => Err(SecureError::NotDirectory),
    }
}

pub(crate) fn open_child_file(
    parent: &File,
    name: &std::ffi::OsStr,
) -> Result<Option<File>, SecureError> {
    let fd = match fs::openat(parent, name, file_flags(), Mode::empty()) {
        Ok(fd) => fd,
        Err(Errno::NOENT) => return Ok(None),
        Err(error) => return Err(from_errno("open child file", error)),
    };
    let file = File::from(fd);
    match file_kind(&file)? {
        EntryKind::File => Ok(Some(file)),
        EntryKind::Directory => Err(SecureError::NotDirectory),
        EntryKind::Symlink => Err(SecureError::Symlink),
        _ => Err(SecureError::NotRegular),
    }
}

pub(crate) fn open_file_path(path: &Path) -> Result<Option<File>, SecureError> {
    let parent = path.parent().ok_or(SecureError::Invalid)?;
    let name = path.file_name().ok_or(SecureError::Invalid)?;
    let directory = open_dir_path(parent)?;
    open_child_file(&directory, name)
}

pub(crate) fn classify_entry(
    parent: &File,
    name: &std::ffi::OsStr,
    hint: EntryKind,
) -> Result<EntryKind, SecureError> {
    if hint != EntryKind::Unknown {
        return Ok(hint);
    }
    let stat = fs::statat(parent, name, AtFlags::SYMLINK_NOFOLLOW)
        .map_err(|error| from_errno("stat unknown directory entry", error))?;
    let kind = entry_kind(FileType::from_raw_mode(stat.st_mode));
    if kind == EntryKind::Unknown {
        Err(SecureError::Unsupported)
    } else {
        Ok(kind)
    }
}

pub(crate) fn for_each_dir_entry<F>(directory: &File, mut visit: F) -> Result<(), SecureError>
where
    F: FnMut(&std::ffi::OsStr, EntryKind) -> Result<(), SecureError>,
{
    let mut entries =
        Dir::read_from(directory).map_err(|error| from_errno("open directory stream", error))?;
    while let Some(entry) = entries.read() {
        let entry = entry.map_err(|error| from_errno("read directory stream", error))?;
        let name = entry.file_name();
        if name.to_bytes() == b"." || name.to_bytes() == b".." {
            continue;
        }
        let name = std::ffi::OsStr::from_bytes(name.to_bytes());
        let kind = classify_entry(directory, name, entry_kind(entry.file_type()))?;
        visit(name, kind)?;
    }
    Ok(())
}

pub(crate) fn open_relative_file(root: &File, relative: &str) -> Result<Option<File>, SecureError> {
    if relative.is_empty()
        || relative.starts_with('/')
        || relative
            .split('/')
            .any(|part| part.is_empty() || part == "..")
    {
        return Err(SecureError::Invalid);
    }

    let mut directory = root
        .try_clone()
        .map_err(|error| from_io("clone repository directory", error))?;
    let mut parts = relative.split('/').peekable();
    while let Some(part) = parts.next() {
        if parts.peek().is_none() {
            return open_child_file(&directory, std::ffi::OsStr::new(part));
        }
        match open_child_dir(&directory, std::ffi::OsStr::new(part))? {
            Some(child) => directory = child,
            None => return Ok(None),
        }
    }
    Err(SecureError::Invalid)
}

pub(crate) fn read_relative_entry_for_git(
    root: &File,
    relative: &str,
) -> Result<Option<Vec<u8>>, SecureError> {
    if relative.is_empty()
        || relative.starts_with('/')
        || relative
            .split('/')
            .any(|part| part.is_empty() || part == "..")
    {
        return Err(SecureError::Invalid);
    }
    let mut directory = root
        .try_clone()
        .map_err(|error| from_io("clone repository directory", error))?;
    let mut parts: Vec<&str> = relative.split('/').collect();
    let name = parts.pop().ok_or(SecureError::Invalid)?;
    for part in parts {
        match open_child_dir(&directory, std::ffi::OsStr::new(part))? {
            Some(child) => directory = child,
            None => return Ok(None),
        }
    }
    let name_os = std::ffi::OsStr::new(name);
    match classify_entry(&directory, name_os, EntryKind::Unknown) {
        Ok(EntryKind::Symlink) => {
            let target = fs::readlinkat(&directory, name_os, Vec::new())
                .map_err(|error| from_errno("read symlink target", error))?;
            Ok(Some(target.into_bytes()))
        }
        Ok(EntryKind::Directory) | Err(SecureError::NotFound) => Ok(None),
        Ok(_) => match open_child_file(&directory, name_os)? {
            Some(mut file) => {
                let mut bytes = Vec::new();
                file.read_to_end(&mut bytes)
                    .map_err(|error| from_io("read current Git file", error))?;
                Ok(Some(bytes))
            }
            None => Ok(None),
        },
        Err(error) => Err(error),
    }
}

#[allow(dead_code)]
pub(crate) fn read_relative_file_from_handle(
    root: &File,
    relative: &str,
) -> Result<Option<Vec<u8>>, SecureError> {
    let Some(mut file) = open_relative_file(root, relative)? else {
        return Ok(None);
    };
    let mut bytes = Vec::new();
    file.read_to_end(&mut bytes)
        .map_err(|error| from_io("read current Git file", error))?;
    Ok(Some(bytes))
}

enum Source {
    File(File),
    Directory(File),
}

fn open_source(path: &Path) -> Result<Source, SecureError> {
    match open_dir_path(path) {
        Ok(directory) => Ok(Source::Directory(directory)),
        Err(SecureError::NotDirectory) => match open_file_path(path)? {
            Some(file) => Ok(Source::File(file)),
            None => Err(SecureError::NotFound),
        },
        Err(error) => Err(error),
    }
}

fn validate_source(source: &Source) -> Result<(), SecureError> {
    match source {
        Source::File(file) => match file_kind(file)? {
            EntryKind::File => Ok(()),
            EntryKind::Symlink => Err(SecureError::Symlink),
            _ => Err(SecureError::NotRegular),
        },
        Source::Directory(directory) => validate_directory(directory),
    }
}

fn validate_directory(directory: &File) -> Result<(), SecureError> {
    for_each_dir_entry(directory, |name, kind| match kind {
        EntryKind::File => match open_child_file(directory, name)? {
            Some(_) => Ok(()),
            None => Err(SecureError::NotFound),
        },
        EntryKind::Directory => match open_child_dir(directory, name)? {
            Some(child) => validate_directory(&child),
            None => Err(SecureError::NotFound),
        },
        EntryKind::Symlink => Err(SecureError::Symlink),
        EntryKind::Other => Err(SecureError::NotRegular),
        EntryKind::Unknown => Err(SecureError::Unsupported),
    })
}

fn copy_file(source: &mut File, destination: &mut File) -> Result<(), SecureError> {
    std::io::copy(source, destination).map_err(|error| from_io("copy file", error))?;
    let permissions = source
        .metadata()
        .map_err(|error| from_io("stat copied file", error))?
        .permissions();
    destination
        .set_permissions(permissions)
        .map_err(|error| from_io("set copied file permissions", error))
}

fn create_child_file(parent: &File, name: &std::ffi::OsStr) -> Result<File, SecureError> {
    let flags = OFlags::WRONLY | OFlags::CREATE | OFlags::EXCL | OFlags::CLOEXEC | OFlags::NOFOLLOW;
    let mode = Mode::RUSR | Mode::WUSR | Mode::RGRP | Mode::WGRP | Mode::ROTH | Mode::WOTH;
    let fd = match fs::openat(parent, name, flags, mode) {
        Ok(fd) => fd,
        Err(Errno::EXIST) => return Err(SecureError::AlreadyExists),
        Err(error) => return Err(from_errno("create destination file", error)),
    };
    Ok(File::from(fd))
}

fn create_child_dir(parent: &File, name: &std::ffi::OsStr) -> Result<File, SecureError> {
    let mode =
        Mode::RUSR | Mode::WUSR | Mode::XUSR | Mode::RGRP | Mode::XGRP | Mode::ROTH | Mode::XOTH;
    match fs::mkdirat(parent, name, mode) {
        Ok(()) => {}
        Err(Errno::EXIST) => return Err(SecureError::AlreadyExists),
        Err(error) => return Err(from_errno("create destination directory", error)),
    }
    match open_child_dir(parent, name)? {
        Some(directory) => Ok(directory),
        None => Err(SecureError::NotFound),
    }
}

fn copy_directory(source: &File, destination: &File) -> Result<(), SecureError> {
    for_each_dir_entry(source, |name, kind| match kind {
        EntryKind::File => {
            let mut source_file = open_child_file(source, name)?.ok_or(SecureError::NotFound)?;
            let mut destination_file = create_child_file(destination, name)?;
            copy_file(&mut source_file, &mut destination_file)
        }
        EntryKind::Directory => {
            let source_directory = open_child_dir(source, name)?.ok_or(SecureError::NotFound)?;
            let destination_directory = create_child_dir(destination, name)?;
            copy_directory(&source_directory, &destination_directory)?;
            let permissions = source_directory
                .metadata()
                .map_err(|error| from_io("stat copied directory", error))?
                .permissions();
            destination_directory
                .set_permissions(permissions)
                .map_err(|error| from_io("set copied directory permissions", error))
        }
        EntryKind::Symlink => Err(SecureError::Symlink),
        EntryKind::Other => Err(SecureError::NotRegular),
        EntryKind::Unknown => Err(SecureError::Unsupported),
    })?;
    let permissions = source
        .metadata()
        .map_err(|error| from_io("stat copied directory", error))?
        .permissions();
    destination
        .set_permissions(permissions)
        .map_err(|error| from_io("set copied directory permissions", error))
}

fn copy_source_to_destination_with_hook<F>(
    source: Source,
    destination_parent: &Path,
    destination_name: &std::ffi::OsStr,
    after_validation: F,
) -> Result<(), SecureError>
where
    F: FnOnce(),
{
    validate_source(&source)?;
    after_validation();
    let parent = open_dir_path(destination_parent)?;
    match source {
        Source::File(mut source_file) => {
            let mut destination_file = create_child_file(&parent, destination_name)?;
            if let Err(error) = copy_file(&mut source_file, &mut destination_file) {
                drop(destination_file);
                return Err(cleanup_after_error(error, &parent, destination_name));
            }
            Ok(())
        }
        Source::Directory(source_directory) => {
            let destination_directory = create_child_dir(&parent, destination_name)?;
            if let Err(error) = copy_directory(&source_directory, &destination_directory) {
                return Err(cleanup_after_error(error, &parent, destination_name));
            }
            Ok(())
        }
    }
}

fn copy_source_to_destination(
    source: Source,
    destination_parent: &Path,
    destination_name: &std::ffi::OsStr,
) -> Result<(), SecureError> {
    copy_source_to_destination_with_hook(source, destination_parent, destination_name, || {})
}

fn cleanup_after_error(error: SecureError, parent: &File, name: &std::ffi::OsStr) -> SecureError {
    match remove_entry(parent, name) {
        Ok(()) => error,
        Err(cleanup) => SecureError::Message(format!("{error}; cleanup failed: {cleanup}")),
    }
}

fn remove_entry(parent: &File, name: &std::ffi::OsStr) -> Result<(), SecureError> {
    let kind = match classify_entry(parent, name, EntryKind::Unknown) {
        Ok(kind) => kind,
        Err(SecureError::NotFound) => return Ok(()),
        Err(error) => return Err(error),
    };
    if kind == EntryKind::Directory {
        let Some(directory) = open_child_dir(parent, name)? else {
            return Ok(());
        };
        remove_directory_contents(&directory)?;
        match fs::unlinkat(parent, name, AtFlags::REMOVEDIR) {
            Ok(()) => Ok(()),
            Err(Errno::NOENT) => Ok(()),
            Err(error) => Err(from_errno("remove copied directory", error)),
        }
    } else {
        match fs::unlinkat(parent, name, AtFlags::empty()) {
            Ok(()) => Ok(()),
            Err(Errno::NOENT) => Ok(()),
            Err(error) => Err(from_errno("remove copied entry", error)),
        }
    }
}

fn remove_directory_contents(directory: &File) -> Result<(), SecureError> {
    for_each_dir_entry(directory, |name, kind| match kind {
        EntryKind::Directory => remove_entry(directory, name),
        EntryKind::Symlink | EntryKind::File | EntryKind::Other => {
            match fs::unlinkat(directory, name, AtFlags::empty()) {
                Ok(()) | Err(Errno::NOENT) => Ok(()),
                Err(error) => Err(from_errno("remove copied entry", error)),
            }
        }
        EntryKind::Unknown => Err(SecureError::Unsupported),
    })
}

pub(crate) fn copy_path(
    source: &Path,
    destination_parent: &Path,
    destination_name: &std::ffi::OsStr,
) -> Result<(), SecureError> {
    match open_source(source)? {
        Source::File(file) => {
            copy_source_to_destination(Source::File(file), destination_parent, destination_name)
        }
        Source::Directory(directory) => {
            copy_directory_from_handle(&directory, destination_parent, destination_name)
        }
    }
}

pub(crate) fn copy_directory_from_handle(
    source: &File,
    destination_parent: &Path,
    destination_name: &std::ffi::OsStr,
) -> Result<(), SecureError> {
    if file_kind(source)? != EntryKind::Directory {
        return Err(SecureError::NotDirectory);
    }
    copy_source_to_destination(
        Source::Directory(
            source
                .try_clone()
                .map_err(|error| from_io("clone source directory", error))?,
        ),
        destination_parent,
        destination_name,
    )
}

#[cfg(test)]
pub(crate) fn copy_directory_from_handle_with_hook<F>(
    source: &File,
    destination_parent: &Path,
    destination_name: &std::ffi::OsStr,
    after_validation: F,
) -> Result<(), SecureError>
where
    F: FnOnce(),
{
    if file_kind(source)? != EntryKind::Directory {
        return Err(SecureError::NotDirectory);
    }
    copy_source_to_destination_with_hook(
        Source::Directory(
            source
                .try_clone()
                .map_err(|error| from_io("clone source directory", error))?,
        ),
        destination_parent,
        destination_name,
        after_validation,
    )
}
