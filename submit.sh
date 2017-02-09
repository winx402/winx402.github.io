#!/bin/sh

echo "git commit -am \""$1"\"" &&
git commit -am $1 &&
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
