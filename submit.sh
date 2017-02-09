#!/bin/sh

echo "**********start commit************\n\n" &&
git commit -am $1 &&
echo "\n\n**********commit complete************\n\n" &&
echo "\n\n**********push start************\n\n" &&
git push
echo "\n\n**********push complete************\n\n" &&
