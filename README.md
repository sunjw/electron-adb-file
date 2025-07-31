# electron-adb-file

**An ADB file tool built on Electron.**

This is a not-finished documentation.

## Open and run
Windows and macOS distribution packages are in [dist](dist) directory.

## Build and run
1. npm install
2. npm rebuild
3. If no error occured in previous steps, then run.

## Update icons
```
./node_modules/.bin/electron-icon-builder --input="./icons/some.png" --output="./"
```

## Pack
```
python3 ./pack_dist_electron.py
```
New package will overwrite exists one in [dist](dist) directory.

## License

[GPL 2.0](LICENSE)
