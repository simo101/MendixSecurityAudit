/// <reference path='./typings/tsd.d.ts' />

'use strict';

import { MendixSdkClient, OnlineWorkingCopy, Project, Revision, Branch, loadAsPromise } from "mendixplatformsdk";
import { ModelSdkClient, IModel, projects, domainmodels, microflows, pages, navigation, texts, security, IStructure, menus } from "mendixmodelsdk";


import when = require('when');


const username = "simon.black@mendix.com";
const apikey = "ba47d0a1-9991-45ee-a14d-d0c1b73d5279";
const projectId = "2c73da5b-ccc6-44a2-99ea-be4e87bb5287";
const projectName = "Company Expenses";
const revNo = -1; // -1 for latest
const branchName = null // null for mainline
const wc = null;
const client = new MendixSdkClient(username, apikey);
var officegen = require('officegen');
var docx = officegen('docx');
var fs = require('fs');
var pObj;
/*
 * PROJECT TO ANALYZE
 */
const project = new Project(client, projectId, projectName);

client.platform().createOnlineWorkingCopy(project, new Revision(revNo, new Branch(project, branchName)))
    .then(workingCopy => loadProjectSecurity(workingCopy))
    .then(projectSecurity => getAllUserRoles(projectSecurity))
    .then(userRoles => createUserSecurityDocument(userRoles))
    .done(
    () => {
        var out = fs.createWriteStream('MendixSecurityDocument.docx');
        docx.generate(out);
        out.on('close', function () {
            console.log('Finished to creating Document');
        });
    },
    error => {
        console.log("Something went wrong:");
        console.dir(error);
    }
    );

/**
* This function picks the first navigation document in the project.
*/
function createUserSecurityDocument(userRoles: security.UserRole[]): when.Promise<security.UserRole[]> {
    pObj = docx.createP();
    return when.all<security.UserRole[]>(userRoles.map(addText));
}

function addText(userRole: security.UserRole): when.Promise<projects.Module[]> {
    return processUsersSecurity(userRole);
}

function processUsersSecurity(userRole: security.UserRole): when.Promise<projects.Module[]> {
    console.log(`Processing User Role: ${userRole.name}`)
    pObj.addText(userRole.name, { bold: true, underline: true, font_size: 20 });
    pObj.addLineBreak();
    return processAllModules(userRole.model.allModules(), userRole);

}

function processAllModules(modules: projects.IModule[], userRole: security.UserRole): when.Promise<projects.Module[]> {
    return when.all<projects.Module[]>(modules.map(module => processModule(module, userRole)))

}

function processModule(module: projects.IModule, userRole: security.UserRole): when.Promise<security.ModuleSecurity> {
    if (module != null) {
        console.log(`Processing module: ${module.name}`);
        pObj.addText(module.name, { bold: true, underline: false, font_size: 18 });
        pObj.addLineBreak();
        return processAllModuleSecurities(getAllModuleSecurities(module),userRole);
    }else{
        return;
    }
}

function processAllModuleSecurities(moduleSecurities:security.IModuleSecurity[], userRole:security.UserRole):when.Promise<security.ModuleSecurity>{
    return when.all<security.ModuleSecurity>(moduleSecurities.map(mSecurity => processModSec(mSecurity, userRole)));

}

function getAllModuleSecurities(module: projects.IModule): security.IModuleSecurity[] {
    return module.model.allModuleSecurities().filter(modSecurity => {
        if (modSecurity != null) {
            return modSecurity.moduleName === module.name;
        } else {
            return false;
        }

    });
}

function processModSec(modSec: security.IModuleSecurity, userRole: security.UserRole): when.Promise<security.ModuleRole> {
    return when.promise<security.ModuleRole>((resolve, reject) => {
        modSec.load(loadedModSec => processLoadedModSec(loadedModSec, userRole));
    });
}

function processLoadedModSec(modSec: security.ModuleSecurity, userRole: security.UserRole): when.Promise<security.ModuleRole[]> {
    return when.all<security.ModuleRole[]>(modSec.moduleRoles.map(modRole => processModuleRole(modRole, userRole)));
}


function processModuleRole(role: security.IModuleRole, userRole: security.UserRole): when.Promise<void> {
    if (role != null) {
        return loadAsPromise(role).then(loadedRole => addIfModuleRoleInUserRole(loadedRole, userRole));

    } else {
        return;
    }
}

function addIfModuleRoleInUserRole(loadedRole: security.IModuleRole, userRole: security.UserRole): when.Promise<void> {
    console.log(`Processing module role: ${loadedRole.name}`)
    if (userRole.moduleRoles.filter(modRole => {
        if (modRole != null) {
            return modRole.name === loadedRole.name;
        } else {
            return false;
        }
    }).length > 0) {
        pObj.addText(loadedRole.name, { bold: true, underline: false, font_size: 15 });
        pObj.addLineBreak();
    }
    return;
}

function processModuleRoles(role: security.ModuleSecurity): when.Promise<void> {
    return when.all<void>(role.moduleRoles.map(loadModuleRole));
}

function loadModuleRole(moduleRole: security.IModuleRole): when.Promise<void> {
    if (moduleRole != null) {
        pObj.addText(moduleRole.name, { bold: true, underline: false, font_size: 13 });
        pObj.addLineBreak()
    } else {
        return;
    }

}

function getAllModules(workingCopy: OnlineWorkingCopy): projects.IModule[] {
    return workingCopy.model().allModules();
}

function processDomainModel(module: projects.IModule, role: security.UserRole): when.Promise<void> {
    return when.all<void>(module.domainModel.entities.map(entity => checkEntity(entity)));
}

function checkEntity(entity: domainmodels.IEntity) {
    return loadAsPromise(entity).then(ent => {
        ent.accessRules
    });
}

function processDocument(document: projects.IDocument, role: security.UserRole): when.Promise<void> {
    if (document instanceof microflows.MicroflowBase) {
        return null;
    } else if (document instanceof pages.Page) {

        return null;
    }
    return null;
}


/**
* This function loads the project security.
*/
function loadProjectSecurity(workingCopy: OnlineWorkingCopy): when.Promise<security.ProjectSecurity> {
    var security = workingCopy.model().allProjectSecurities()[0];
    return when.promise<security.ProjectSecurity>((resolve, reject) => {
        if (security) {
            security.load(secure => {
                if (secure) {
                    console.log(`Loaded security`);
                    resolve(secure);
                } else {
                    console.log(`Failed to load security`);
                    reject(`Failed to load security`);
                }
            });
        } else {
            reject(`'security' is undefined`);
        }
    });
}

function getAllUserRoles(projectSecurity: security.ProjectSecurity): security.UserRole[] {
    return projectSecurity.userRoles;
}




