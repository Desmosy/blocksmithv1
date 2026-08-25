# BlockSmith Annotate — Figma development plugin

The plugin turns BlockSmith's visual and structural analysis into reviewable native Figma annotations. It maps proposals into Figma's Development, Interaction, Accessibility, and Content categories and can pin supported node properties.

## Install

1. In Figma Desktop, open **Plugins → Development → Import plugin from manifest**.
2. Select this directory's `manifest.json`.
3. Open a writable design file and run **Plugins → Development → BlockSmith Annotate**.

## Connect

1. In BlockSmith, sign in and create an API key under **Setup → API keys**.
2. Enter `http://localhost:3000` during local development or the production BlockSmith origin.
3. Paste the `bs_live_…` key. It is stored in Figma's private `clientStorage`, not in the Figma document.
4. Select frames/components, click **Generate AI proposals**, review every checked proposal, then click **Apply selected**.

The plugin exports up to four small previews to BlockSmith for visual analysis. Existing annotations are sent as context and preserved when proposals are applied. A local deterministic preview remains available without the server.
