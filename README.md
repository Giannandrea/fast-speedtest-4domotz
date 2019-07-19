# fast-speedtest-4domotz
Nodejs speedtest module using fast.com servers and created as a poc for domotz remote poawn agent.

## Introduction
This project is a prof of concept in order to verify the possibility to use a node module for a speedtest using fast.com servers.
Considering its scope this module must work on agend architectures and in cpu without FPU so it must work on node 0.10.37 and above.
this module has been tested on node versions 0.10.x, 4.4.x, 6.9.x, 8.11.x 11.x 12.x and should works also with the intermediate versions. 
## Installation
In order to install directly from github with npm run this command:
```
npm install --save --global https://github.com/Giannandrea/fast-speedtest-4domotz/tarball/master
```
*(in case of "npm ERR! code EACCES" try to run the command above with sudo)*
To avoid --global you can add your current path in PATH env.

## Usage
As a proof of concept this module provide the a command line with some parameters to simplify the test
```
$ fast-speedtest [options]
```
### options
- **--verbose** This option enables the verbose output printing also intermediate measures [default: false]
- **--bufferSize** The numbers of measures used to mediate each speed and mitigate peaks [default: 3]
- **--parallel_connections** The number of parallel connections used to download the file [default: 8]
- **--min_url_count** Number of server that will be used and so the number of downloads [default: 4]
- **--https:** If true api version2 will be used otherwise v1 with plain http download [default: false]

### Examples
```
fast-speedtest --bufferSize 3 --parallel_connections 8 --min_url_count 5 -v
```
This command will test the connections speed downloading 5 files from 5 different servers, with 8 connection (rannge) each one and the buffersize 3.

### Install RC version
It's not a real RC version however the rc-1.3.0 have some new features a bit over the scope of this POC.
It is possible to install it in order to test also ping and client informations features installing the branch from npm:
```
npm install --save --global https://github.com/Giannandrea/fast-speedtest-4domotz/tarball/rc-1.3.0
```
*(in case of "npm ERR! code EACCES" try to run the command above with sudo)*
