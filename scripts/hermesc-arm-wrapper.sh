#!/usr/bin/env bash
# Macht 'eas update' auf einem aarch64-Rechner möglich.
#
# Der Hermes-Compiler, den Expo mitbringt, ist eine x86_64-Binärdatei. Auf
# srv-2 (aarch64) lässt sie sich nicht ausführen, und 'eas update' scheitert
# beim Übersetzen in Bytecode. Statt einen anderen Compiler einzusetzen -- die
# Bytecode-Version muss exakt zur App passen -- wird derselbe emuliert.
#
# Nach jedem 'pnpm install' erneut ausführen: node_modules wird dabei ersetzt.
set -euo pipefail

dir=$(command ls -d node_modules/.pnpm/hermes-compiler@*/node_modules/hermes-compiler/hermesc/linux64-bin | head -1)
[ -n "$dir" ] || { echo "hermesc nicht gefunden"; exit 1; }

if [ -f "$dir/hermesc.x86_64" ]; then
  echo "Wrapper liegt schon: $dir/hermesc"
  exit 0
fi

qemu=$(nix build --no-link --print-out-paths nixpkgs#qemu | head -1)
chmod u+w "$dir"
cp "$dir/hermesc" "$dir/hermesc.x86_64"
cat > "$dir/hermesc" <<WRAP
#!/usr/bin/env bash
exec "$qemu/bin/qemu-x86_64" "\$(dirname "\$0")/hermesc.x86_64" "\$@"
WRAP
chmod +x "$dir/hermesc"
echo "Wrapper gesetzt: $dir/hermesc"
