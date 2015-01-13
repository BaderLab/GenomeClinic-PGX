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



## Package installation:

To get all the node packages:

`npm install`

To start the server on localhost, port 8080:

`node server.js`


## Annovar Installation

Annovar is a suite of perl tools that can be downloaded from [Here](http://www.openbioinformatics.org/annovar/annovar_download_form.php). It requires you to register prior to downloading the file, a link will then be sent to the email provided. 

once downloaded, open a terminal and navigated to the annovar/ directory and run the following commands to install the appropriate databases


```shell
perl annotate_variation.pl -buildver hg19 -downdb -webfrom annovar ljb26_all humandb/
perl annotate_variation.pl -buildver hg19 -downdb -webfrom annovar cg69 humandb/
perl annotate_variation.pl -buildver hg19 -downdb -webfrom annovar esp6500_all humandb/
perl annotate_variation.pl -buildver hg19 -downdb -webfrom annovar 1000g2014sep_all humandb/
perl annotate_variation.pl -buildver hg19 -downdb -webfrom annovar clinvar_20140929 humandb/
```

These can be exceptionally large files so the download will take some time.
