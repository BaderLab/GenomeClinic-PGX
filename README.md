Frangipani
==========

Web application for clinical pharmacogenomic interpretation.

## Quick setup

The application server in development is in accordance with GA4GH API. Currently it is being tested with the Google Genomics cloud service.

The application server uses [Node.js](http://nodejs.org/), so download and install that first.

## MongoDB installation and setup

MongoDB is a noSQL database with built in js support. The application requires a local mongodb server to be running. to install mongo you can download the binaries from[here](http://www.mongodb.org/downloads) for all platforms and distributions.

Once installed you will need to run the mongo server prior to running the main server. 
you first need to create a data director and then type the following to start the server listening on port 27017

`mongod --path=data/ --port 27017`

this will start the server listening on port 27017 using the data/ directory which was previously created to store
all the data. feel free to change the data directory, however, if you change the port ensure that you also change
the port in the DB.js file



## Package installation:

To get all the node packages:

`npm install`

To start the server on localhost, port 8080:

`node server.js`
