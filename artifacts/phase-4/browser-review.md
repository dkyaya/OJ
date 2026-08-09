# Browser Review Status

## Production Baseline

The deployed GitHub Pages application was inspected through the in-app browser on 2026-08-08. It loaded without console errors, but it is still the older `main` build: it exposes the legacy nine-item information architecture and older catalyst calendar. This confirms production has not silently picked up the unmerged repair branch.

## Current Branch

The current branch production bundle built successfully, but visual browser execution is pending. The managed workspace rejected local port binding, and the in-app browser correctly blocked a direct `file://` build. No third-party preview service was used because that would move unpublished code outside the approved deployment path.

The current source has explicit responsive rules for 320×568, 360×800, 390×844, 412×915, 768×1024, 1024×768, 1280×800, and 1440×900. Automated tests cover navigation normalization, shared cards, calendar local-date behavior, exports, sync mapping, conflicts, and payoff calculations. A final visual pass at those eight viewports remains required after the branch has a trusted preview or the owner merges it.

The loading view uses fixed viewport bounds with flex centering on both axes; it is independent of the desktop sidebar and mobile navigation. Reduced-motion users receive effectively static animation.
