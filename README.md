# Minesweeper in Python

## Overview

This is an implementation of original Microsoft Minesweeper in Python. It is made by me over the course of 2 days completely from scratch including all the code and assets.

Minesweeper in Python runs on Python 3.9. It uses SDL library with the help of amazing PyGame 2 package.

## Installation Instructions

1. Install Python 3.9 from [Python.org](https://www.python.org/)
2. Clone this repository to any directory with write access
3. Depending on your OS:
- If you are on Windows just start _'prepare and run.bat'_ batch file. It will create python's virtual environment and install dependencies if it isn't done already. Then it will run the game.
- For other platforms:
```batch
pip install -r requirements.txt
pythonw main.py
```

## Changing game settings

To change field size and mine count open _main.py_ and change appropriate values at the beginning. Save and run the game.

## Differences from original game

Two-way click on number to reveal all adjacent non-flagged tiles replaced with simple left click. It work only if number of flags is the same as the number on clicked tile.

This change significantly reduces hand strain and avoids mice grinding but introduces risk of accidentally misclicking on a mine.

## Licence

[![Creative Commons «Attribution-NonCommercial» 4.0](https://i.creativecommons.org/l/by-nc/4.0/88x31.png)](http://creativecommons.org/licenses/by-nc/4.0/)
