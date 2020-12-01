# electron-adb-file

**An ADB file tool built on Electron.**

This is a not-finished documentation.

## Open and run
Windows and macOS distribution packages are in [dist](dist) directory.

## Build and run
1. npm install
2. npm rebuild
3. npm run rebuild-node-pty
4. If no error occured in previous steps, then run.

## Pack
python3 ./pack-dist.py  
New package will overwrite exists one in [dist](dist) directory.  
After upgrade Electron, using below command to package with new Electron dist:  
python3 ./pack-dist.py --no-extract-old  

## License

[GPL 2.0](LICENSE)
