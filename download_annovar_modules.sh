#!/usr/bin/env bash
USAGE="USAGE: download_annovar_modules.sh  <path_to_annovar_folder>"

if [ -d $1 ];then
	ANNOPATH=$1
	SCRIPT="$ANNOPATH/annotate_variation.pl"
	if [ ! -f $SCRIPT ];then
		echo $USAGE
		echo -e "\vCannot find annotate_variation.pl"
		echo "Please provide proper path"
		exit 1
	else
		echo $SCRIPT
		echo $ANNOPATH
	fi	
else
	echo $USAGE
	echo -e "\vPath to folder does not exist"
	exit 1
fi

dbs=(knowngene ljb26_all cg69 esp6500_all 1000g2014sep_all clinvar_20140929 snp138)
ldbs=${#dbs[@]}

echo -e "\vStarting Download for ${ldbs} required annotation databases"
echo "================================================================================="
echo "Some of the databases are very large and may take some time to download"
echo -e "Downloading databases to ${ANNOPATH}/humandb/\v\v"
for (( i=0; i<${ldbs}; i++ ));do
	echo "DOWNLOADING ANNOTATION ${dbs[$i]} $((1 + ${i}))/${ldbs}"
	$SCRIPT -buildver hg19 -downdb -webfrom annovar ${dbs[$i]} $ANNOPATH/humandb/
done

echo -e "\v\vAll downloads are complete."
exit 0