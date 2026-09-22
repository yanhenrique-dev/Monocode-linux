import { copyText } from "../lib/clipboard";
import { useCopyFeedback } from "../lib/copyFeedback";
import { playCue } from "../lib/sounds";
import { Check, Copy } from "../chrome/icons";

/** Copy-to-clipboard button for a branch name with a "copied" flash. */
export function CopyBranchNameButton({ branch }: { branch: string }) {
  const { copied, flash } = useCopyFeedback(branch);

  return (
    <button
      type="button"
      title={copied ? "Copied" : "Copy branch name"}
      aria-label={copied ? "Copied" : "Copy branch name"}
      className="shrink-0 rounded p-0.5 text-content/40 hover:bg-content/8 hover:text-content/70"
      onClick={() => {
        void copyText(branch).then(
          () => {
            playCue("copy");
            flash();
          },
          () => {},
        );
      }}
    >
      {copied ? (
        <Check className="size-3" strokeWidth={1.75} />
      ) : (
        <Copy className="size-3" strokeWidth={1.75} />
      )}
    </button>
  );
}
