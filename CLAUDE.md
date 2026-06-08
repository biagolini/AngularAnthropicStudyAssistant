# IT Certification Study App — Claude Code Instructions

## Project Summary
Angular single-page application for studying any IT certification exam (AWS, GCP, Azure, MongoDB, Anthropic, etc.). Mobile-first. Static output for GitHub Pages and S3. No backend.

## Critical Rules (never violate)
- No emojis anywhere: not in UI text, not in code comments, not in variable names, not in generated content, not in placeholder text, not in helper messages
- No external UI component libraries (no Angular Material, no PrimeNG, no CDK, no Bootstrap)
- No NgModules — all components are standalone
- No HttpClient — use native fetch() for all HTTP calls
- No innerHTML with unsanitized strings — build DOM trees via Angular templates
- No backend, no SSR, no server-side logic
- No hardcoded colors in component SCSS — always use CSS custom property tokens from _variables.scss

## Code Style
- TypeScript strict mode enabled
- Angular Signals for all reactive state (no BehaviorSubject, no Subject, no EventEmitter for state)
- inject() over constructor injection everywhere
- SCSS for all styles — no inline styles in templates
- One component per file
- No barrel index.ts files
- Prefer computed() over manual derivation in templates

## Architecture
- Three tabs on mobile (Input, Questions, Export); two-column layout on desktop (min-width: 768px)
- Settings (certification name, domains, API key, clear data) in a slide-over drawer triggered by gear icon in header
- Theme toggle (light/dark) in header next to gear icon; default is light
- localStorage keys prefixed with cert_study__
- API Key: cert_study__api_key (plain string)
- Questions: cert_study__questions (JSON array)
- Settings: cert_study__settings (JSON: certificationName, domains[], theme)
- System prompt is built dynamically at call time using certificationName and domains from SettingsService
- If no domains are defined, all questions go to domain "General"
- All file downloads via Blob + URL.createObjectURL; never open new tabs

## Naming Conventions
- Services: feature-name.service.ts
- Components: feature-name.component.ts
- Models: model-name.model.ts
- Utils: util-name.util.ts
- localStorage keys: cert_study__snake_case

## Touch & Accessibility
- All interactive elements: minimum 44x44px touch target
- All buttons and inputs must have aria-label when icon-only
- Sufficient color contrast in both light and dark themes

## When Adding Features
- Add model changes to core/models/ first
- Update StorageService if persistence is needed
- Update SettingsService if it relates to user configuration
- Keep components thin — business logic in services or utils
- New colors must be added to _variables.scss for both themes
