#!/bin/sh

echo "git add ." &&
git add . &&
echo "git commit -m \""$1"\"" &&
git commit -m "$1" &&
echo "\ngit push" &&
git push &&
echo "\nhexo clean" &&
hexo clean &&
echo "\nhexo g" &&
hexo g &&
echo "\nhexo d" &&
hexo d &&
echo "complete!!!"
exit 1
