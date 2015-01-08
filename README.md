Frangipani
==========

Web application for clinical pharmacogenomic interpretation.

## Quick setup

The application server in development is in accordance with GA4GH API. Currently it is being tested with the Google Genomics cloud service.

The application server uses [Node.js](http://nodejs.org/), so download and install that first from the link provided. Node.js Will run on all machines, simply download the appropriate binaries or installers.

## MongoDB installation and setup

MongoDB is a noSQL database with built in js support. Our web application requires a local MongoDB server to be running. To install, you can download the binaries [here](http://www.mongodb.org/downloads) for all platforms and distributions.

Once installed, you will need to run the MongoDB server prior to running our web application server. Create a `db_data/` directory and then type the following to start the server listening on port 27017

`mongod --dbpath=db_data/ --port 27017`


Feel free to change the location of the `db_data/` directory. If you change the port ensure that you also change
the corresponding port number in DB.js.

If you are using windows and would like to install mongoDB as a service to run in the background you first must create at mongodb.cfg file
in the mongoDB directory. The config file contains information about the db-path and the logfile path (as well as anything else you need to define).
To make the file open an a command prompt as the administrator and type (change the path as necessary):

`echo logpath="C:\Program Files\MongoDB\log\mongo.log" > "C:\Program Files\MongoDB\mongod.cfg"
echo dbpath="C:\Program Files\MongoDB\data\db" > "C:\Program Files\MongoDB\mongod.cfg"
echo port=27017 > "C:\Program Files\MongoDB\mongod.cfg"`

Next, install mongoDB as a service:

`"C:\Program Files\MongoDB\bin\mongod.exe" --config "C:\Program Files\MongoDB\mongod.cfg" --install`

If the install is successful, start the service by typing:

`net start MongoDB`


## Package installation:

To get all the node packages:

`npm install`

To start the server on localhost, port 8080:

`node server.js`
