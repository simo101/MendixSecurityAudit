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
            console.log('Finished to create Document');
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
function createUserSecurityDocument(userRoles: security.UserRole[]):when.Promise<security.UserRole[]> {
     pObj = docx.createP();
    return when.all<security.UserRole[]>(userRoles.map(addText));
}

function addText(userRole:security.UserRole):when.Promise<void>{

        return processUsersSecurity(userRole);
}

function processUsersSecurity(userRole:security.UserRole):when.Promise<void>{
        pObj.addText(userRole.name,{ bold: true, underline: true, font_size:20 } );
        pObj.addLineBreak();
        return processAllModuleRoles(userRole);
}

function processAllModuleRoles(userRole:security.UserRole):when.Promise<void>{
    return when.all<void>(userRole.moduleRoles.map(processModuleRole));
}

function loadRole(userRole:security.IUserRole):when.Promise<security.UserRole>{
    return loadAsPromise(userRole);
}

function processModuleRole(role:security.IModuleRole):when.Promise<void>{
    if(role!= null){
            pObj.addText(role.name, { bold: true, underline: false, font_size:15 });
            pObj.addLineBreak();
            return;
    };

    return null;
}


function getAllModules(workingCopy: OnlineWorkingCopy): projects.IModule[] {

    return workingCopy.model().allModules();

}
function processModules(modules: projects.IModule[]): when.Promise<void> {
    return when.all<void>(modules.map(processModule));
}

function processModule(module: projects.IModule): when.Promise<void> {
    return null;
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




