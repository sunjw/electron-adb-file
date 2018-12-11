#!/bin/sh

app_name='electron-adb-file.app'

cd dist
tar -xvf $app_name.tar.gz
rm -rf $app_name/Contents/Resources/app
mkdir $app_name/Contents/Resources/app
cd ..

cp -r asserts dist/$app_name/Contents/Resources/app/
cp -r css dist/$app_name/Contents/Resources/app/
cp -r js dist/$app_name/Contents/Resources/app/
cp -r node_modules dist/$app_name/Contents/Resources/app/

cp index.html dist/$app_name/Contents/Resources/app/
cp main.js dist/$app_name/Contents/Resources/app/
cp package.json dist/$app_name/Contents/Resources/app/
cp package-lock.json dist/$app_name/Contents/Resources/app/
cp README.md dist/$app_name/Contents/Resources/app/
cp LICENSE dist/$app_name/Contents/Resources/app/

cd dist/$app_name/Contents/Resources/app/
npm rebuild
cd ../../../../../

cd dist
rm $app_name.tar.gz
tar -czvf $app_name.tar.gz $app_name
rm -rf $app_name
