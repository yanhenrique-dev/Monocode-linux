# Frontend UI — shadcn + Base UI sobre tokens MonoCode

Decisão: sem troca de framework, sem restyle GNOME. Refinar com
`src/components/ui/` (estilo shadcn, copy-paste) sobre primitivas
`@base-ui/react`, mantendo identidade glass/tokens runtime.

## Vocabulário de tokens

- Fonte: `src/index.css` + `src/lib/appearance.ts` (runtime: hue, saturation,
  dark-lightness, sidebar, accent, glass). Nunca substituir.
- Utilitários Tailwind (`text-content`, `bg-background-base`, `border-stroke`,
  `bg-selection`, `bg-accent`): 1262 call sites. Não renomear.
- Bridge shadcn (fim de `index.css`): `--background`, `--foreground`,
  `--card`, `--popover`, `--primary`, `--secondary`, `--muted`, `--border`,
  `--input`, `--ring` (link-color, adapta dark/light), `--accent`,
  `--destructive`, `--radius`. Dark = `:root` default; light =
  `html.theme-light`; accent = `html.has-user-accent`. Variante `dark:` já
  mapeada via `@custom-variant` (`html:not(.theme-light)`).
- Componentes novos usam bridge ou tokens diretos. Cores shadcn default
  hardcoded proibidas.

## Regras de wrappers

- Wrappers preservam API pública atual (Modal sm/md, Popover anchor/side,
  ExplorerMenu items, SecondaryButton danger). Call sites não reescrevem
  em massa; 1 família por PR.
- Portals usam `LAYER` (`src/lib/layers.ts`): popover 80, submenu 81,
  dialog 90, dialogPopover 91, toast 100. Nunca `z-50` shadcn.
- `GlassBackdrop` dentro de Dialog/Popover quando glass ligado.
- `useExitAnimation` + keyframes `modal-*`/`popover-open` mantidos, com
  fallback timeout para WebKitGTK. Rewire para `data-[state]` Base UI
  onde preciso, sem remover fallback.
- Overflow nativo + `useLockOverscroll`. Sem ScrollArea pesada.
- DnD (`useAnimatedReorder`) intacto; Base UI não gerencia reorder.
- Testes: ajustar só arquivos com DOM mudado; preferir
  `getByRole('dialog')` / `getByRole('menuitem')` nos novos.

## Não mexer

glass-body, no-ui-blur, hw-reduced, has-chat-background, has-user-accent,
theme-light, appearance.ts, useComposer, ComposerRunner, drag/paste Tauri,
`.composer-field`, virtual scroll transcript, markdown pipeline.

## Splits pós-F0 (estrutura atual)

- `chrome/Composer.tsx` → + `chrome/composer/ComposerParts.tsx`
- `chrome/Sidebar.tsx` → + `chrome/sidebar/SessionFolderRow.tsx`,
  `chrome/sidebar/SidebarProps.ts`
- `app/useComposer.ts` → + `app/composer/useComposerModels.ts`
- `app/useSessionSync.ts` → + `app/sessionSync/useHarnessFlush.ts`
- `surfaces/SettingsView.tsx` (shell lazy) → `surfaces/settings/*`
  (Controls, Select, Slider, Sounds, Accent, Chrome)
- `lib/motion.ts`: `useReducedMotion` / `prefersReducedMotion` /
  `reorderMotion` (única fonte de motion)
- Overlay views (Search/Settings/Inbox/Notes) via `lazy` + Suspense no App

## Baseline F0 (2026-09-22)

- Arquivos com `<button>`: 99; sem `focus-*` algum: 62
  (plano estimava 72/99 sem focus-visible; com ring global todos cobertos)
- `title=`: 272 ocorrências em 76 arquivos
- `role="dialog"`: 20 arquivos
- `outline-none`: 50 arquivos; `focus-visible`: 28 arquivos
- Imports ExplorerMenu/Modal/Popover: 50 arquivos
- Deps: `@base-ui/react` 1.8 (= `@base-ui-components/react` renomeado),
  clsx, tailwind-merge, class-variance-authority já presentes — nada a instalar
- F0 entrega: `src/lib/utils.ts` (cn), `components.json`, alias `@/`,
  bridge tokens + `:where(:focus-visible)` global, `ui/button.tsx`,
  SecondaryButton como wrapper (API intacta, visual idêntico)
- Verificado F0: `check:web` verde (280 files, 3056 tests), `tsc` 0,
  `eslint` 0 errors, `vite build` ok. Screenshots dark/light: manual,
  pendente no gate.

## F1.2 dialog (2026-09-22)

- `src/components/ui/dialog.tsx`: Root/Portal (LAYER, default 90)/
  Popup/Title/Description/Close sobre `@base-ui/react`
- `Modal.tsx`: mesma API pública; Popup vira frame; Title/Description via
  `render` (mesmo h2/p, mesmos ids); trap Tab via Base; Escape de
  `data-dialog-popover` ainda não fecha o dialog
- Exceção: initial focus + restore explícitos (app desmonta dialogs com
  open=true, path onde Base pula finalFocus) — `finalFocus={false}`
- `Modal.test.ts`: static markup → mount happy-dom; novos: trap Tab,
  Escape fecha, restore foco no opener. 7/7 verde; suite 3059 verde

## F1.3 popover (2026-09-22)

- `chrome/Popover.tsx`: mesma API pública; positioning via Base
  (Floating UI flip/shift, `sideOffset`=gap, `collisionPadding`=padding,
  `positionMethod="fixed"`); `lib/popover.ts` não mais importado
  (aposentar arquivo + teste no gate)
- Fora Base de propósito: outside-press próprio em pointerdown (Base só
  fecha em click/intentional), Escape próprio global (funciona sem foco),
  initial focus + restore explícitos nos callers
- Portal Base monta async (+1 commit): pickers focam via retry rAF
  (contrato mantido); `finalFocus={false}` (callers restauram);
  frameInset 2px preservado no maxHeight; CSS `data-side` p/ origin
- Achado e corrigido: wrapper Button F0 não repassava `ref`
  (trigger.current null) — Button agora com ref-as-prop React 19
- Testes ajustados (timing async): SidebarRename retry, NotificationSettings
  flush pós-click. Suite 3059 verde, tsc 0, eslint 0 errors

## F1.4 menus (2026-09-22)

- Decisão: ExplorerMenu NÃO reescrito. Já tem ARIA (menu/menuitem/
  menuitemcheckbox, activedescendant), keyboard (setas/Enter/Space/Escape),
  submenus hover e roda sobre Popover Base. Reescrever p/ Base Menu
  trocaria semântica testada sem ganho visual — risco > valor
- `ui/dropdown-menu.tsx` + `ui/context-menu.tsx` novos: Root/Trigger/
  Portal (LAYER)/Positioner (frame glass + Popup)/Item/Separator/Submenu,
  tokens MonoCode; p/ menus novos simples
- `ui/menus.test.tsx`: trigger abre, item dispara, contextmenu abre. 2/2
- Suite 3061 verde, tsc 0, eslint 0 errors

## F1.5 controles (2026-09-22)

- Novos: `ui/switch.tsx` (button nativo via render), `ui/slider.tsx`
  (input range nativo no thumb), `ui/select.tsx`, `ui/input.tsx`;
  `ui/controls.test.tsx` 4/4
- Mantidos sem rewire (decisão): SettingsControls Toggle/Segmented
  (button nativo = semântica exata), SettingsSlider (range nativo com
  previews rAF), SettingsSelect (Tab-commit + activedescendant),
  SearchableSelect — reescrever trocaria comportamento testado
- Tentativa revertida: Toggle sobre Base Switch perdeu `disabled` nativo
  (Base usa span + aria-disabled) e quebrou 3 testes SettingsView
- Suite 3065 verde, tsc 0, eslint 0 errors

## F1.6 toast (2026-09-22)

- `ui/toast.tsx`: Provider (timeout 5s, limit 3)/Viewport (LAYER.toast)/
  Root/Content (glass)/Title/Description/Close/Action + `ToastList`
  (viewport não renderiza sozinho — lista explícita obrigatória)
- ApprovalToasts mantido declarativo (prefs por projeto, sem auto-dismiss);
  gate a11y (aria-live, sem roubo de foco) já atendido

## F1.7 tooltip parcial (2026-09-22)

- `ui/tooltip.tsx`: Trigger via render + Portal LAYER.popover; delay no
  Trigger (Root não tem); popup Base sem role (query por portal)
- 20 title= migrados → 0 em Composer/TitleBar/SurfaceTabs/Sidebar
  (total repo 272→253); aria-labels preservados/adicionados
- IconButton compartilhado com Tooltip afetou InboxView (markup estático)
- Testes ajustados p/ aria-label; interação hover validada no smoke
  WebKitGTK (happy-dom não reproduz modalidade de ponteiro Base)
- Suite 3067 verde, tsc 0, eslint 0 errors (1 pre-existente em TitleBar)

## F5 Settings UX (2026-09-22)

- `ui/alert-dialog.tsx` novo (role=alertdialog, sem dismiss em backdrop,
  LAYER.dialog, glass); ConfirmDialog rewired p/ ele, mesma API
  (Cancel com foco, restore manual, Escape=cancel explícito)
- AppearancePage: lógica de setProperty/vars INTACTA (nenhum toque em
  appearance.ts ou theme runtime); settings controls já cobertos em F1.5
- SettingsView archive-delete agora role=alertdialog (helper de teste
  cobre dialog+alertdialog); suite 3069 verde

## GATE (2026-09-22) — GO condicional

| Métrica | Baseline | Agora | Status |
|---|---|---|---|
| focus-visible global | 62 arq sem focus | ring global `:where` cobre 100% | ok |
| dialogs trap+restore | manual Tab | Modal Base trap + restore; ConfirmDialog alertdialog | ok |
| primitivos em ui/ | 0 | 11 (button/dialog/menus/switch/slider/select/input/toast/tooltip/alert-dialog) | ok |
| title= paths MVP | 20 | 0 (repo 272→253) | ok |
| check:web | — | 3069 pass + tsc 0 | ok |
| lint/knip | — | 0 errors (só pré-existentes) | ok |
| perf | — | sem baseline; virtual scroll intocado | n/a |
| checklist visual 10 itens | — | PENDENTE usuário (dark/light/accent/glass/HiDPI) | pendente |
| smoke WebKitGTK | — | PENDENTE usuário (`npm run tauri dev`) | pendente |
| uso real 2-3 dias | — | PENDENTE usuário | pendente |

GO código; GO final após checklist + smoke + uso. Se blocker: fallback A
(a11y-only) já parcialmente entregue (ring global, traps, tooltips).

## F2 Composer (2026-09-22)
- ComposerParts: ToolButton/Send/Stop/queue Save/Cancel/Edit/Remove →
  Tooltip, title removido, aria-labels intactos
- AttachmentChip (3 title=) + ContextMeter Compact → Tooltip
- Plus-menu: só texto visível, sem title — intocado
- Não tocado: useComposer, drag/paste, .composer-field, ComposerRunner
- Suite 3069 verde, tsc 0, eslint 0 errors

## F3 Sidebar (2026-09-22)- FolderRenameRow → ui Input (+ aria-label, ref-forward no Input)
- Pickers mantidos (retry rAF, activedescendant); `ui/combobox.tsx` novo
  p/ pickers novos (filtro + seleção testados)
- Tooltip orchestration custom mantido: teste exige hover sync + role,
  Base não cobre (popup sem role, hover async)
- DnD/useAnimatedReorder/ProjectRail intocados
- Suite 3070 verde, tsc 0, eslint 0 errors

## F4 Transcript pontual (2026-09-22)
- Copy/Save/Edit-resend → Tooltip (aria-labels intactos)
- Mantidos: Turn metrics (já abre Popover), ApprovalControls Allow/Deny
  (texto visível), folds/virtual scroll/markdown, truncation titles (F7)
- Suite 3070 verde, tsc 0, eslint 0 errors

## F6 restos (2026-09-22)
- RemoveProjectDialog → ConfirmDialog (body slot novo; -70 linhas portal manual)
- SwitchBranchDialog → Modal (hideClose novo; trap+restore ganhos; guards busy intactos)
- ImageLightbox: Tab trap + Tooltip (fullscreen mantido)
- FilePicker: mantido (palette sem dim, posição própria)
- `ui/tabs.tsx` novo p/ tab sets estáticos; SurfaceTabs com DnD mantido
- Menus/pickers restantes (Inbox*, Editor, Branch/Skill/Cwd/File/Git/Worktree):
  avaliados, ficam custom (mesma rationale F1.4/F1.5)
- Suite 3071 verde, tsc 0, eslint 0 errors

## F7 (2026-09-22) — parcial + incidente
- Migrados p/ Tooltip: GitChangesPanel 4, Orchestration 3, SessionReview 2,
  LinkedWorkItem 2, PlanPreview, FilePreview, BinaryFileView 2, InboxComments,
  InboxPrChecks, PetsSettings, AgentMarkdown, ToolDiffPreview (via AgentMarkdown)
- Exceção: botões disabled com title explicativo mantêm title quando disabled
  (Chrome não dispara hover em disabled); InboxView 4 iguais
- title= repo: 272→225; restantes: truncations + paths fora MVP
- INCIDENTE: script outline-none danificou 32 arquivos; revertida 23, reparada
  14 via prettier; 1 perda real: shell SettingsView.tsx do split do usuário
  → reconstruído do monólito HEAD + módulos settings/* (733 linhas removidas,
  16 de import; blocos conferidos 1:1 modulo export/indentação)
- Suite 3071 verde, tsc 0, eslint 0 errors (2 pre-existentes FileEditor/editorGit)

## Gate (fim F1+F5)

Metas: focus-visível global ok; 21/21 dialogs com trap; primitivos soltos
<= 6 wrappers; title= paths MVP -50%; check:web verde; perf ±10%;
checklist 10 itens 100%; uso real 2-3 dias sem blocker.
Resultado registrado aqui (GO / NO-GO + motivos).
