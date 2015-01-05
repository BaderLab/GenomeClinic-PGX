Frangipani
==========

Web application for clinical pharmacogenomic interpretation.

## Quick setup

The application server in development is in accordance with GA4GH API. Currently it is being tested with the Google Genomics cloud service.

The application server uses [Node.js](http://nodejs.org/), so download and install that first.

## MongoDB installation and setup

MongoDB is a noSQL database with built in js support. Our web application requires a local MongoDB server to be running. To install, you can download the binaries [here](http://www.mongodb.org/downloads) for all platforms and distributions.

Once installed, you will need to run the MongoDB server prior to running our web application server. Create a `db_data/` directory and then type the following to start the server listening on port 27017

`mongod --dbpath=db_data/ --port 27017`

Feel free to change the location of the `db_data/` directory. If you change the port ensure that you also change
the corresponding port number in DB.js.

## Package installation:

To get all the node packages:

`npm install`

To start the server on localhost, port 8080:

`node server.js`
