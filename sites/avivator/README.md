# Avivator

Avivator is a lightweight "batteries-included" WebGL viewer for remote imaging data, built around Viv.
A hosted instance of Avivator can be accessed at [avivator.gehlenborglab.org](avivator.gehlenborglab.org).

Please checkout our [video tutorial](https://www.youtube.com/watch?v=_GES8BTzyWc) to get started.

## Development system requirements

Avivator has been tested with the following dependency versions:

- Operating system: Red Hat Enterprise Linux 9.6
- [Node.js](https://nodejs.org/) (v18+ recommended)
- NPM 6.14.4
- [`pnpm`](https://pnpm.io) (Install via `npm install -g pnpm`)
- Zsh 5.7.1
- one of:
  - Firefox Developer Edition 84.0b8
  - Firefox 80.0.1 (and later)
  - Safari 13.1.1 (and later)
  - Google Chrome 87.0.4280.88

## Development Guide

Avivator is developed as part of the [Viv](https://github.com/hms-dbmi/viv) monorepo.

To develop or run Avivator locally from this fork (`viv-ambcat`), follow these steps using [`pnpm`](https://pnpm.io):

---

### Setup and Run

```bash
# Clone the viv-ambcat repository
git clone git@github.com:hereon-GEMS/viv-ambcat.git
cd viv-ambcat

# Install all dependencies across the monorepo using pnpm
pnpm install

# Start the development server
pnpm dev
```

This command starts a live development server. Navigate to `http://localhost:3000`
in your web browser to view the site. You may edit the contents of `src/` (Viv codebase)
or `avivator/`, and the changes should be applied automatically.

## Production build

You may build a static production build of Avivator with the following:

```sh
npm run build:avivator
```

which outputs the final build in `avivator/dist`. This directory can be deployed as
static site in production.

## Instructions for use

To use Avivator to visualize your own imaging data, use the URL input in the web application to provide a URL to an OME-TIFF/Bioformats-Zarr.

To learn more about working with OME-TIFF files or Bioformats-Zarr stores, please visit the [tutorial](../tutorial/README.md).
