# High Level Design

## Intro

This application serves as a learning app for persons wanting to learn how to solve Rubik's cube and its derivatives like Pyraminx.

## Tech stack

* vanilla javascript
* three.js to visualize the cube or other figures in 3D and rotate them using mouse
* openCV to detect the colors on the cube to give hints or detect when user made a mistake
* it's ok to use webassembly

* First let's decide on layout, and prepare the environment.
* let's prepare a complex 3D geometry representing a Pyraminx
* let's scaffold a Computer vision to detect colors
