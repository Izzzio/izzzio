#!/usr/bin/env python

import os
import uuid
from xml.sax.saxutils import escape

scriptDir = os.path.dirname(os.path.normpath(os.path.abspath(__file__)))
buildDir = os.path.join(os.path.dirname(os.path.dirname(scriptDir)), 'build')

dirs = {
        'ELECTRONDIR': 'BitcoenWallet-win32-x64',
        'COREDIR': 'core',
    }

def print2(str):
    # On Windows `print` sometimes cause "IOError [errno 0]".
    try:
        print(str)
    except:
        pass

def toIdentifier(string):
    id = ''
    first = True
    for ch in string:
        c = ord(ch)
        if (c >= ord('a') and c <= ord('z')) or (c >= ord('A') and c <= ord('Z')) or ch == '_':
            id += ch
        elif (c >= ord('0') and c <= ord('9')) or ch == '.':
            #if first:
            #    id += '_'
            id += ch
        else:
            id += '_'
        first = False
    return id

def guidForFile(name):
    if os.path.exists('guids.lst'):
        with open('guids.lst', "r") as f:
            for line in f.readlines():
                s = line.rstrip().split(' ', 1)
                if s[1] == name:
                    return s[0]
    guid = uuid.uuid1()
    with open('guids.lst', "a") as f:
        f.write('%s %s\n' % (guid, name))
    return guid

def addDir(dirId, path, indent = '        '):
    print2(path)
    for file in os.listdir(os.path.join(buildDir, path)):
        if file == 'BitcoenWallet.exe':
            continue
        relpath = os.path.join(path, file)
        srcpath = os.path.join('..', '..', 'build', relpath)
        fileId = '%s.%s' % (dirId, toIdentifier(file))
        if len(fileId) > 72:
            fileId = '_' + fileId[len(fileId)-71:]
        if os.path.isdir(srcpath):
            f.write('%s<Directory Id="%s" Name="%s">\n' % (indent, fileId, escape(file)))
            addDir(fileId, relpath, indent + '    ')
            f.write('%s</Directory>\n' % (indent))
        else:
            allIds.append(fileId)
            guid = guidForFile(relpath)
            f.write('%s<Component Id="%s" Guid="%s">\n' % (indent, fileId, str(guid)))
            f.write('%s    <File Id="%s" Name="%s" Source="%s" KeyPath="yes" />\n' % (indent, fileId, escape(file), escape(srcpath)))
            f.write('%s</Component>\n' % indent)

allIds = []
with open("files.wxi", "w") as f:
    f.write('<?xml version="1.0" encoding="windows-1251"?>\n')
    f.write('<Include>\n')
    for dirId, path in dirs.items():
        f.write('    <DirectoryRef Id="%s">\n' % dirId)
        addDir(dirId, path)
        f.write('    </DirectoryRef>\n')
    f.write('    <Feature Id="Complete" Level="1">\n')
    f.write('        <ComponentRef Id="BitcoenWallet.exe" />\n')
    for id in allIds:
        f.write('        <ComponentRef Id="%s" />\n' % id)
    f.write('        <ComponentRef Id="ProgramMenuDir" />\n')
    f.write('    </Feature>\n')
    f.write('</Include>\n')
