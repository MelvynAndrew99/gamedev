{
  description = "Phaser 4 game development environment";

  inputs = {
    # 26.05 is the final nixpkgs release supporting Intel Macs. Keeping this
    # branch lets flake-utils' full default system set continue to evaluate.
    nixpkgs.url = "github:nixos/nixpkgs/nixpkgs-26.05-darwin";
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
            nodejs_24

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
            echo "🎮 Phaser 4 development environment loaded"
            echo "Node version: $(node --version)"
            echo "npm version: $(npm --version)"
          '';
        };
      }
    );
}
