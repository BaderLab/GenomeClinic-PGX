##Contributing to git

The git repository is currently set up to have a single stable master branch that is "ready to go" from the box. DO NOT make any commits/merges/pull request to this repository unless authorized.


##Contributing to the development branch

The main development branch is the discovery branch. To get the latest version pull the discovery branch into your local repository.
This should be done frequently so as to encorperate the latest changes into your code.

Ideally you should NEVER be making DIRECT commits or pushes to the discovery branch to ensure stability of the development branch. 
Insteadt, whenever you are working on a feature you should branch discovery and make all of your changes within the separate branch.
To ensure consistancy use the following naming schema for your branches.


1. Adding a feature:	feature/<feature name>. Ie  feature/db
2. fixing an issue:		issue/<issue Number>. Ie.  issue/122
3. hotfixes:			hotfix/<issue number or feature name>. ie hotfix/23


those are the naming schema for now (more to come when we come across them). you should be making commits and pushes to the same branch
you are working on locally to the remote directory. for example 

`git push origin feature/db` 

will push the commits on your current local branch to the remote `feature/db` branch, creating it if it does not exist. This allows for multiple people to be working on the same feature if required. When you think you have a complete feature, or fix  the appropriate method for mergin it back into the discovery branch is to submit a pull request directly from the repository website on github.


To do this, first commit then push your changes to the remote branch ie `feature/db` if not already done so. Next navigate to the main repository page and select the green icon at the top labeled: create and compare pull request. This will open a new page. At the top change the base to `discovery` and the head to the branch that you are working on `feature/db`

You must then provide a title and several comments about the pull request. Try to be descriptive. If you are changing a specific function think about including sample code. The more descriptive the better. Once you are satisfied with the comments you have supplied and have looked over the changes that will be made, submit the pull request.

This will not immediately merge the code into the discoery branch. Instead it opens a forum that people can review comment and make recommendations on your pull request. If suggestions for changes are made and you decide to incorperate them you can include them in the pull by simply pushing to the remote branch from your local repository. After the code has been reviewed and all parties are satisfied with it someone who is authorized can then confirm the merge, submitting a comment on the merge and merge the pull request into the discovery branch. This process closes the pull request to further issues 	