import os
import sys
import shutil
import subprocess

# Set console encoding to UTF-8 on Windows to avoid UnicodeEncodeError for emojis
if sys.platform.startswith("win"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except AttributeError:
        pass

def main():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    src_dir = os.path.join(root_dir, "package", "resources", "app")
    dist_parent = os.path.join(root_dir, "dist")
    dist_dir = os.path.join(dist_parent, "IDEpro")
    electron_dir = r"C:\Users\Open Pc\AppData\Local\Programs\Antigravity IDE"
    output_zip = os.path.join(dist_parent, "IDEpro-Portable.zip")

    # Step 0: Clean dist
    print("🧹 Cleaning dist...")
    if os.path.exists(dist_dir):
        shutil.rmtree(dist_dir)
    os.makedirs(os.path.join(dist_dir, "resources"), exist_ok=True)

    # Step 1: Pack app.asar
    print("📦 Packing app.asar...")
    asar_out = os.path.join(dist_dir, "resources", "app.asar")
    try:
        subprocess.run(
            ["npx", "--yes", "@electron/asar", "pack", src_dir, asar_out],
            check=True,
            shell=True,
            cwd=root_dir
        )
        print("✅ app.asar packed")
    except Exception as e:
        print(f"❌ Failed to pack app.asar: {e}", file=sys.stderr)
        sys.exit(1)

    # Step 2: Copy app.asar.unpacked (native modules)
    unpacked_src = os.path.join(electron_dir, "resources", "app.asar.unpacked")
    if os.path.exists(unpacked_src):
        print("📋 Copying app.asar.unpacked...")
        shutil.copytree(unpacked_src, os.path.join(dist_dir, "resources", "app.asar.unpacked"))

    # Step 3: Copy Electron runtime
    print("🔧 Copying Electron runtime...")
    skip_files = {"Antigravity IDE.exe", "unins000.exe", "unins000.dat"}
    for entry in os.listdir(electron_dir):
        if entry in skip_files:
            continue
        src = os.path.join(electron_dir, entry)
        dst = os.path.join(dist_dir, entry)
        if os.path.isdir(src):
            shutil.copytree(src, dst, dirs_exist_ok=True)
        else:
            shutil.copy2(src, dst)

    # Step 4: Rename/copy electron EXE -> IDEpro.exe
    print("📝 Renaming EXE to IDEpro.exe...")
    shutil.copy2(
        os.path.join(electron_dir, "Antigravity IDE.exe"),
        os.path.join(dist_dir, "IDEpro.exe")
    )

    # Step 5: Create ZIP
    print("🗜️ Creating ZIP...")
    if os.path.exists(output_zip):
        os.remove(output_zip)

    # Create zip from dist_dir content (but exclude dist_dir base folder inside zip, just pack its children)
    zip_base = os.path.splitext(output_zip)[0]
    shutil.make_archive(zip_base, "zip", dist_dir)

    print("\n✅ Done!")
    print(f"📦 Output: {output_zip}")
    print(f"📁 Portable folder: {dist_dir}")
    print(f"\n💡 To run directly: {dist_dir}\\IDEpro.exe")

if __name__ == "__main__":
    main()
