import os
import sys
from collections import OrderedDict
import re
import json

###
#class InputError(error):
#	def __init__(self,expr,msg):
#		self.expr = expr
#		self.msg = msg
###

def convert(inp):
	try:
		return int(inp)
	except ValueError:
		try:
			return float(inp)
		except ValueError:
			return inp

#if len(sys.argv) < 3 or len(sys.argv) >= 4:
	#raise InputError("Invalid number of arguments")

fileName = sys.argv[1]
outFileName = sys.argv[2]

print outFileName

outputList = [] 

start = True
inFile = open(fileName,'r')
for line in inFile:
	if start: 
		#First line add headers to the headerInfo variable for later use
		headerInfo = line.strip("\n").split("\t") # splits the headers
		headerInfo = headerInfo[0:headerInfo.index('Otherinfo')]
		headerInfo = map(lambda s: s.replace(".","_"),headerInfo) #remove periods
		headerInfoLen = len(headerInfo)
		start = not start #set start flag to false
	else:
		line = line.strip("\n").split("\t") 
		tempDict = OrderedDict()#temp dict that stores current variables
		variantInfoFlag = False # Will be set to true once the index is greater then the length of the headerInfo
		variantInfo = []
		for i in range(0,len(line)):
			if variantInfoFlag: #static information that will always be included from the original vcf file
				variantInfo = line[i].split(':')
				for j in range(0,len(variantInfoHeaders)): # loop over all invluded variant Info Header. relies on a format field being present previousl
					field = re.findall(	r"[a-z0-9]+", variantInfo[j])#remove all punctuation 
					temp = map(lambda s: convert(s),field)#convert from string to int or float
					if len(temp) is 1:
						temp = temp[0] 

					tempDict[variantInfoHeaders[j]] = temp


					if variantInfoHeaders[j] == 'GT': #if thhis is the GT field additionally add several other flags
						sep = re.findall(r"[/|]",variantInfo[j])[0]
						tempDict['GTRAW'] = variantInfo[j]

						if sep == "|":
							sep = "true"
						else:
							sep = "false"

						tempDict['phased_status'] = sep

						if 'phased_status' not in headerInfo:
							headerInfo.append('phased_status')
						if 'GTRAW' not in headerInfo:
							headerInfo.append("GTRAW")	
			

					if variantInfoHeaders[j] not in headerInfo:
						headerInfo.append(variantInfoHeaders[j])
					variantInfoFlag = not variantInfoFlag	
				break
			
			elif i >= headerInfoLen: #have exceeded the annotations added by annovar
				if "GT:" in line[i]: # static info that will always be included
					variantInfoHeaders = line[i].split(':')
					variantInfoFlag = not variantInfoFlag

				elif re.match("rs[0-9]+$",line[i]) is not None: 
					tempDict['identifier'] = line[i]
					if 'identifier' not in headerInfo:
						headerInfo.append('identifier')

			else: # 
				if line[i] is not '.':
					if ',' in line[i]:
						line[i] = line[i].split(',')
						line[i] = map(convert,line[i])
					else:
						line[i] = convert(line[i])

					tempDict[headerInfo[i]] = line[i]

		outputList.append(tempDict)


inFile.close()


with open(outFileName,'w') as output:
	json.dump(outputList,output)
		
