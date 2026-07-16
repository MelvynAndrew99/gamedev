{
  description = "Phaser.js game development environment";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            # Node.js runtime and package manager (npm included)
            nodejs

            # Build and development tools
            git
            gnumake
            pkg-config

            # Optional: TypeScript support
            typescript

            # Optional: Common bundlers/dev servers
            # esbuild
            # vite

            # Useful utilities
            curl
            jq
          ];

          shellHook = ''
            echo "🎮 Phaser.js development environment loaded"
            echo "Node version: $(node --version)"
            echo "npm version: $(npm --version)"
          '';
        };
      }
    );
}
