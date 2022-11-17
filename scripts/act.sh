#!/bin/bash

if [ $# -eq 0 ]
then
  curl https://raw.githubusercontent.com/nektos/act/master/install.sh | bash
else
  curl https://raw.githubusercontent.com/nektos/act/master/install.sh | bash -s -- v$1
fi
