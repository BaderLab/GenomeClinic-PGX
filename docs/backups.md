## Methods for Creating Database Backups

Depending on your implementation of mongodb there are several methods that you can use to create a backup of the database. there are several mongodump options that can be used to export a databse in another format, but surprisingly the recommended backup method is actually quite simple. Accroding to the [MongoDB Documentation](http://docs.mongodb.org/manual/core/backups/), the easiest way to back up a database is to simply copy the underlying data files that it relies upon.

When you start the mongod service, it stores all data in the specied `dbpath`. if you have set the path yourself then you simply copy and paste the db directory to a secure location. This will copy not only the data but also all users, permissions, and included databses as well. 

To restore the database either you have one of two options.

1. Copy a previous backup and replace all of the dbpath directory.
2. change where dbpath is pointing to and restart the mongod service. This can be accomplished either via command line, or by specifying the dbpath in mongo.conf file.