{ pkgs }:
{
  nodejs = pkgs.nodejs_24;
  pnpm = pkgs.pnpm_11.override { nodejs-slim = pkgs.nodejs-slim_24; };
  bun = pkgs.bun;
}
