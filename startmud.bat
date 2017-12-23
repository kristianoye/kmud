@echo off

:RunMud
	node server.js  %*
	IF %ERRORLEVEL% EQU 0 GOTO :RunMud
	
:ExitMud
	
	echo "Exiting (with error code %ERRORLEVEL%)

