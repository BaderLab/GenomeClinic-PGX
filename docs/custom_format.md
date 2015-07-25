## Custom File Format for Variant Information

GenomeClinic-PGX accepts two file formats for uploading genetic variation. The first is the standard [VCF](http://www.1000genomes.org/wiki/analysis/variant%20call%20format/vcf-variant-call-format-version-41) format which contains a wealth of information, however much of it is not used for the purpose of the app. The app relies on the use of marker id's, whether custom or from dbsnp, for all positional information, instead of relying on chromosome and position. Marker Id's provide a reference that is not build specific and easily updated, as opposed to relying on lifting over information for each chromosomal position when variants with different builds are uploaded. Additionally, the app does not use any annotation, quality, or filter information and it is therefore unnecessary to store the information. This information can be ignored when the file is being parsed, however it requires that the file is unnecessarily large and could increase upload time. 

We have proposed a modified file format that strips the VCF file of all annotation information and positional information, leaving a bare boned version of the file that can be rapidly uploaded and parsed by the server. The file contains all relevant information that the server needs to perform the PGX analysis. 


### Example

##fileformat=PGXv1.0
| #ID | REF | ALT |	FORMAT | <PATIENT> |
|:--: | :--:|:--:|:--:|:--:|
|rs123  | A | G  | GT | 0/1 |
|rs5522 | G | GAC|GT  |	1/1 |
|rs021	|TG |T   | GT |	0/1 |


### File Format Specification


#### File Format line
The first line of the file defines the specified file format. It is required, and must be present otherwise an error will occur. If PGX is present, then the server will attempt to parse the custom file format and insert it into the database. The line has the following format:

##fileformat=PGXv1.0


### Fields
A single tab separated header line is required, defining the contents of the file. There are 4 required fields, with at least one additional field required defining the patient, but more patient fields can be added.

1. #ID - Marker Id as a dbSnp rsID or a custom marker. This is a required field and must be populated otherwise the line will be ignored
2. REF - The reference allele. Alleles are in the same format defined in the VCF documentation. It consists of a single allele and is a required field and must be populated.
3. ALT - The alternate allele. Alleles are in the same format defined in the VCF documentation. Multiple alleles can be defined in this field as a comma separated list, if this field is empty it will simply be ignored by the server
4. FORMAT - Defines the format that the following patient fields will appear in as a list separated by colons. Each item in the list is an abbreviation, however there is only a single item required. The genotype, denoted by GT, must always be present otherwise the entry will not be considered as it is being entered into the database.
a. 
5. <PATIENT> - The patient column follows the same format as the FORMAt column. The header for the patient column must be a unique identifier for the patient. This will be used as a unique name, unless another name is defined by the user. 
	a. GT - Genotype. Two numbers separated by either a `/` or a `|` defining the genotype. the different numbers identify whether it's a reference or an alternate allele. A "0" signifies the reference allele, while any number greater then 0 is the Alternate allele. Additionally phasing is defined by the separator, `|` indicates a phased genotype, while `/` indicates an unphased genotype.

