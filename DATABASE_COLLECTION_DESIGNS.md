## Design of documents and collections for mongodb:	

The following document contains information about the various database structures being using within the back end mongoDB.


### Admin Collection
The admin collection contains information pertinent to the running of the server. This is configurable information taht can be changed by the Admin user. The collection is comprised of a single document.

**Default Collection Name:** admin

| **Field**  | **Type** | **Definition** | **Indexed** |
|:------------|:-----:|:------------|:------:|
|_id | ObjectId | Unique document Id | yes |
| curr_patient_index | Number | Current number to be appened to a new patient collection (p<NUM>)to store vcf info | no |
| config | Bool | Stores the status of the databse, ie has it been configured by the user or not | no | 
| instiution | String | The institution that is using the PGX app | no |
| admin-email | String | Enail of the admin user. Setting this provides the admin certain privileges over a regular user. | no |
| annovar-path | String | Path to the annovar executable | no |
| genome-build | String | Current Genome build being used for alignment ex. hg19 | no|
| max-query-records | Number | Deprecated | no |
| report-footer | String | Generic disclaimer used on the bottom of reports | no | 
| annovar-dbs  | Array | List of databases to use when annotating the variant file |no |
| annovar-usage | Array | List of usage for the each database ex. g/f|  no| 
| annovar-index | array | which annotations should be indexed after they have been uploaded | no |

```js
{
	"_id" : ObjectId(),
	"curr_patient_index" : Number,
	"curr_panel_index" : Number,
	"config" : Boolean,
	"institution" : String,
	"admin-email" : email,
	"annovar-path" : Path,
	"genome-build" : String,
	"max-query-records" : Number,
	"report-footer" : String,
	"annovar-dbs" : [],
	"annovar-usage" : [],
	"annovar-index" : []
}
```

### Users Collection 
Information specific to each user. currently this field is underutilized and does not really have any use beyond logging in and out

**Default Collection Name:** users


| **Field**  | **Type** | **Definition** | **Indexed** |
|:------------|:-----:|:------------|:------:|
|_id | ObjectId | Unique document Id | yes |
|username | String | Unique email for each user | yes |
| password | String | Bcrypted password string | no |


```js
{
	"_id" : ObjectId(),
	"username" : String,
	"password" : bcrypt
}
```



### Patients Collection
Contains information about all the patients that have been uplaoded, including the collection name for the patient variant information

**Default Collection Name:** patients

| **Field**  | **Type** | **Definition** | **Indexed** |
|:------------|:-----:|:------------|:------:|
|_id | ObjectId | Unique document Id | yes |
| patient_id | String | Unique patient Identifier given by the user | yes |
| file | String | File name of the vcf file | no |
| added | Date | Date the file was uploaded initially | no |
| ready | Bool | Whether the file has finished annotation and uploading to db | no |
| completed | Date | Date the file finished uploading | no |
| owner | String | Email of the user who uplaoded the patient | no |
| collection_id | String | Name of the Collection containing the annotated vcf file |no |
| tags | Array | Name of projects the patient is included in | no |



```js
{
	"_id" : ObjectID,
	"patient_id" : String,
	"file" : String,
	"added" : String,
	"ready" : true,
	"completed" : String,
	"owner" : String,
	"collection_id" : String,
	"tags" : Array
}
```
2015-05-12 15:51:37


### Individual Patient Collection
Each patient has an individual patient collection assigned to them when they are uploaded. This contains all of the information from the annotate vcf file, each document in this collection corresponds to a single entry in the .vcf file. The number assigned to the patient collections is found in admin.curr_patient_index and is incremented each time a patient is added.

**Default Collection Name:** p(number);

| **Field**  | **Type** | **Definition** | **Indexed** |
|:------------|:-----:|:------------|:------:|
|_id | ObjectId | Unique document Id | yes |
| chr | String | Chromosome | yes |
| pos | Number | Position of variant | yes | 
| id | string | rsID of the Variant if any | yes |
| ref | String | Reference Allele for this position | no |
| alt | Array | Array of alternate alleles for this position | no |
| original_alt | String | Original alternate allele prior to shifting position | no |
| original_ref | String | Original reference allele prior to shifting position | no |
| original_pos | String | Original position prior to shifiting | no |
| zygosity | String | Based on the genotype is the user homo_ref homo_alt or heter | yes | 
| gt-raw | String | Raw genotype with phasing status recorded in vcf file | no |
| gt | Array | Genotype of the patient, first index  is ref, second is alt | no |
| phased_status | Bool | Whether the information is phased or not | no |

```js
{
	"_id" : ObjectId(),
	"chr" : String,
	"pos" : Number,
	"id" : string,
	"ref" : String,
	"alt" : String,
	"original_alt" : String,
	"original_ref" : String,
	"original_pos" : Number,
	"zygosity" : String,
	"gt-raw" : String,
	"gt" : [ ref , alt ],
	"phased_status" : Boolean
}
```


### Project Collection
Each document in the project collection corresponds to a separate project. The document outlines the projectname and permissions, as well as when it was created.

**Default Collection Name:** projects

| **Field**  | **Type** | **Definition** | **Indexed** |
|:------------|:-----:|:------------|:------:|
|_id | ObjectId | Unique document Id | yes |
| project_id | String | Unique Id given to each project by the user | yes |
| description| String | Description of the project | no |
| keywords | string | Keywords assigned to the project, kind of like a short description| no |
| owner | String | Email of the user who created the project | no | 
| users | Array | Emails of all authorized users added to the project | no |
| date | Date | Date the project was created | no |


```js
{
	"_id" : ObjectId,
	"project_id" : String,
	"keywords" : String,
	"description" : String,
	"owner" : String,
	"users" : Array,
	"date" : String
}
```

### PGx Marker Collection
Each document in this collection corresponds to a single marker used in the PGX analyis and has information on the position and alleles for that marker.

**Default Collection Name:** pgxCoordinates

| **Field**  | **Type** | **Definition** | **Indexed** |
|:------------|:-----:|:------------|:------:|
|_id | ObjectId | Unique document Id | yes |
| id | String | Unique rsID corresponding to the rsID's in dbSNP | yes |
| alt | Array | Expected alternate alleles | no |
| ref | String | Reference allele | no |
|chr | String | Chromosome the marker is situated on | no |
| pos| Number | Base position of the marker on the chromosome |no |


```js
{
	"_id" : ObjectId(),
	"id" : String,
	"alt" : Array,
	"chr" : String,
	"pos" : Number,
	"ref" : String
}
```


### PGx Genes Collection
Each document corresponds the a gene. Each gene has information on the haplotypes for that gene, and the markers associated with the haplotype

**Default Collection Name:** pgxGenes

| **Field**  | **Type** | **Definition** | **Indexed** |
|:------------|:-----:|:------------|:------:|
|_id | ObjectId | Unique document Id | yes |
|gene| String | Unique gene name that the haplotypes apply to | yes |
| haplotypes| Object | Object containing information on all the haplotypes, the keys of the object are the haplotypes themselves | no |
| HAPLOTYPE_NAME | Array | HAPLOTYPE_NAME is substituted for the actual haplotype name with its value set to an array of marker ID's. the ID's correspond to ids in the pgx Marker Collection | no | 


```js
{
	"_id" : ObjectId(),
	"gene" : String,
	"haplotypes" : {
		"HAPLOTYPE_NAME" : Array
	}
}
```


### Therapeutic Classes
0
### Drug Recomendations Collection
The Drug recomendation collection consists of all the information required to make current and future recomendation for a patients genetic profile. Each entry corresponds to a single gene that is used as the unique identifier. All recomendation information for that gene is contained in the document.

**default collection name:** drugRecomendations


| **Field**  | **Type** | **Definition** | **Indexed** |
|:------------|:-----:|:------------|:------:|
|_id | ObjectId | Unique document Id | yes |
| gene | String | Unique Gene name | yes |
| haplotypes | Object | Consists "remembered" haplotpyes for the specific therapeutic class | no |
| THERAPEUTIC_CLASS | Array | THERAPEUTIC_CLASS is substituted for the actual class name. The value is set to an array of two strings, the remembered haplotypes for that class | no |
| recomendations | Object | All the recomendations for the gene | no |
| DRUG_NAME | Object | DRUG_NAME is substituted with the actual drug name. Each drug consists of an object that has the recomendations for each therapeutic class recorded for that drug | no |
| rec | String | The recomendation for the therapeutic class  and drug | no |
| risk | String |The associated risk for the given recomendation | no | 
| pubmed  | Array | Array consisting of pubmed ID's as strings | no |
| secondary | Object | This object contains keyes of gene names which also interact with the current drug, changing the recomendation for that drug |  no |
| GENE_NAME | Object | GENE_NAME is substituted with the name of a secondary gene that changes the recomendation for the current drug. The changed recomendation is contained in an object under GENE_NAME | no |
| future | Object | future recomendations and considerations based on the genetic profile of an individual | no |


```js
{
	"_id" : ObjectId(),
	"gene" : String, // unique key
	"haplotypes" : { 
		"THERAPEUTIC_CLASS": [hap, hap]
	},
	"recomendations" : { 
		"DRUG_NAME":{
			"THERAPEUTIC_CLASS_NAME": {
				"rec" : String, //default recomendation when no secondary gene found
				"risk" :  String, //default risk when no secondary gene found
				"pubmed" : [PMID], //default pubmed refereces when no secondary gene found
				"secondary" : {
					"GENE_NAME": {
						"THERAPEUTIC_CLASS_NAME":{
							"rec" : String,
							"risk" : String,
							"pubmed" : [PMID]
						}
					}
				}
			}
		}
	},
	"future" : {
		"THERAPEUTIC_CLASS_NAME" : {
			"rec" : String
		}

	}
}
```


