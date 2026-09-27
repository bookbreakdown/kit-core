# Workflow — edit, tag, pin

The npm counterpart of `/var/www/openshelf/knowledge/vendor-workflow.md`.

## Editing

1. Edit in `/var/www/vendor/mobile-kit` (this checkout). Do not edit a copy inside a consuming
   app's `node_modules`.
2. `npm test` and `npm run typecheck` at the root.
3. Bump the changed package's `version` in its `package.json` (semver).
4. Commit, then tag per package: `git tag reader-v0.3.0` (pattern `<pkg>-v<semver>`).
5. Publish: `npm publish --workspace @libraryofages/<pkg>` to public npm (organisation
   `libraryofages`, MIT, `publishConfig.access: public`), after `npm login` as an org member.
   kit-core first, since the other three depend on it. No token or `.npmrc` is involved.
   Until then, `npm pack --workspace @libraryofages/<pkg>` produces a tarball an app can
   install by path.
6. Pin the new version in the consuming app's `package.json` and `npm install` there.

## Local development against an app

Point the app's Metro at this checkout instead of a published version: add the kit root to
`watchFolders` and `nodeModulesPaths` in the app's `metro.config.js` (see
`apps/playground/metro.config.js`), and map `@libraryofages/*` to `packages/*/src/index.ts` in
the app's `tsconfig.json` `paths`. Never commit a symlink into the app.

## Playground first

Every package feature is built and driven in `apps/playground` on fixtures before an app adapter
is written. The playground's Maestro/Playwright flows are the package-level acceptance.
