#!/usr/bin/env bash

echo "Installing dependencies"
npm install

echo "Ignoring settings directory"
git update-index --assume-unchanged $(git ls-files settings | tr '\n' ' ')

echo "Done!"