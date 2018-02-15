/// <reference path='./typings/tsd.d.ts' />

'use strict';

import { MendixSdkClient, OnlineWorkingCopy, Project, Revision, Branch, loadAsPromise } from "mendixplatformsdk";
import { ModelSdkClient, IModel, projects, domainmodels, microflows, pages, navigation, texts, security, IStructure, menus } from "mendixmodelsdk";


import when = require('when');


const username = "{username}";
const apikey = "{apikey}";
const projectId = "{projectID}";
const projectName = "{projectName}";
const revNo = -1; // -1 for latest
const branchName = null // null for mainline
const wc = null;
const client = new MendixSdkClient(username, apikey);
var officegen = require('officegen');
var docx = officegen('docx');
var fs = require('fs');
var pObj;
const tableStyle = {
    tableColWidth: 4261,
    tableSize: 24,
    tableAlign: "left",
    tableFontFamily: "Arial",
    borders: true,
    sz: '10'
}
  
var table: any[] = [
    [
        {
            val: "User Role",
            opts: {
              b:true,
              sz: '10',
              color:"000000",
              shd: {
                fill: "EEEEEE",
                "themeFillTint": "80"
              },
              fontFamily: "Arial"
            }
        },
        {
            val: "Module",
            opts: {
              sz: '10',
              b:true,
              color:"000000",
              shd: {
                fill: "EEEEEE",
                "themeFillTint": "80"
              },
              fontFamily: "Arial"
            }
        },
        {
            val: "Module Role",
            opts: {
              sz: '10',
              b:true,
              color:"000000",
              shd: {
                fill: "EEEEEE",
                "themeFillTint": "80"
              },
              fontFamily: "Arial"
            }
        },
        
    {
      val: "Entity",
      opts: {
        b:true,
        sz: '10',
        color:"000000",
        shd: {
          fill: "EEEEEE",
          "themeFillTint": "80"
        },
        fontFamily: "Arial"
      }
    },{
      val: "Xpath",
      opts: {
        b:true,
        sz: '10',
        color: "000000",
        align: "left",
        shd: {
          fill: "EEEEEE",
          "themeFillTint": "80"
        }
      }
    },{
      val: "Create/Delete",
      opts: {
        sz: '10',
        align: "center",
        vAlign: "center",
        color:"000000",
        b:true,
        shd: {
          fill: "EEEEEE",
          "themeFillTint": "80"
        }
      }
    },{
        val: "Member Rules",
        opts: {
          align: "center",
          vAlign: "center",
          sz: '10',
          color:"000000",
          b:true,
          shd: {
            fill: "EEEEEE",
            "themeFillTint": "80"
          }
        }
      }]
  ]
  
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
        console.log(table);
        docx.createTable (table, tableStyle);
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

function addText(userRole: security.UserRole): when.Promise<void> {
    return processUsersSecurity(userRole);
}

function processUsersSecurity(userRole: security.UserRole): when.Promise<void> {
    console.log(`Processing User Role: ${userRole.name}`)
    // pObj.addText(userRole.name, { bold: true, underline: true, font_size: 18 });
    // pObj.addLineBreak();
    return processAllModules(userRole.model.allModules(), userRole);
    
}

function processAllModules(modules: projects.IModule[], userRole: security.UserRole): when.Promise<void> {
    // pObj.addLineBreak();
    return when.all<void>(modules.map(module => processModule(module, userRole)))

}

function processModule(module: projects.IModule, userRole: security.UserRole): when.Promise<void> {
    console.log(`Processing module: ${module.name}`);
    // pObj.addText(module.name, { bold: true, underline: false, font_size: 16 });
    // pObj.addLineBreak();
     var securities = getAllModuleSecurities(module);
    return when.all<void>(securities.map(security => loadAllModuleSecurities(securities,userRole)));
    
}

function loadAllModuleSecurities(moduleSecurities: security.IModuleSecurity[], userRole: security.UserRole): when.Promise<void> {
    return when.all<void>(moduleSecurities.map(mSecurity => processLoadedModSec(mSecurity,userRole)));
}

function getAllModuleSecurities(module: projects.IModule): security.IModuleSecurity[] {
    return module.model.allModuleSecurities().filter(modSecurity => {
        if (modSecurity != null) {
            return modSecurity.containerAsModule.name === module.name;
        } else {
            return false;
        };

    });
}

function loadModSec(modSec: security.IModuleSecurity): when.Promise<security.ModuleSecurity> {
    return loadAsPromise(modSec);
}

function processLoadedModSec(modSec: security.IModuleSecurity, userRole: security.UserRole):when.Promise<void>{
    return when.all<void>(modSec.moduleRoles.map(modRole => processModRole(modRole,userRole)));
}

function processModRole(modRole:security.IModuleRole, userRole:security.UserRole):when.Promise<void>{
    if(addIfModuleRoleInUserRole(modRole, userRole)){
        // pObj.addText(modRole.name, { bold: false, underline: false, font_size: 12 });
        // pObj.addLineBreak();
        return detailEntitySecurity(modRole,userRole);
    }
}

function detailEntitySecurity(modRole:security.IModuleRole,userRole:security.UserRole):when.Promise<void>{  
    return when.all<void>(modRole.containerAsModuleSecurity.containerAsModule.domainModel.entities.map(entity =>
        processAllEntitySecurityRules(entity,modRole,userRole)));
}

function processAllEntitySecurityRules(entity:domainmodels.IEntity,moduleRole:security.IModuleRole,userRole:security.UserRole):when.Promise<void>{
    return loadAsPromise(entity).then(loadedEntity => 
        checkIfModuleRoleIsUsedForEntityRole(loadedEntity,loadedEntity.accessRules, moduleRole,userRole));
}

function checkIfModuleRoleIsUsedForEntityRole(entity:domainmodels.Entity,accessRules:domainmodels.AccessRule[], modRole:security.IModuleRole,userRole:security.UserRole):when.Promise<void>{
    return when.all<void>(
        accessRules.map(rule =>{
            var memberRules = ``;
            if(rule.moduleRoles.filter(entityModRule =>{
                return entityModRule.name === modRole.name;
            }).length > 0){
                    rule.memberAccesses.map(memRule =>{
                        if(memRule != null){
                            if(memRule.accessRights!= null && memRule.attribute != null){
                                memberRules += `${memRule.attribute.name}: ${memRule.accessRights.name}\n`;
                            }
                        }
                        
                    }
                );
                var createDelete;
                if(rule.allowCreate && rule.allowDelete){
                    createDelete = `Create/Delete`
                 }else if(rule.allowCreate){
                    createDelete = `Create`
                 }else if(rule.allowDelete){
                    createDelete = `Delete`
                 }else{
                    createDelete = `None`
                 }
                table.push([`${userRole.name}`,`${entity.containerAsDomainModel.containerAsModule.name}`,`${modRole.name}`,`${entity.name}`,`${rule.xPathConstraint}`,`${createDelete}`,`${memberRules}`]);
                console.log(`${userRole.name},${entity.containerAsDomainModel.containerAsModule.name},${modRole.name},${entity.name},${rule.xPathConstraint},${createDelete},${memberRules}`);
            }
        })
    );

}

function addIfModuleRoleInUserRole(modRole: security.IModuleRole, userRole: security.UserRole): boolean{
        console.log(`Processing module role: ${modRole.name}`);
        if (userRole.moduleRoles.filter(modRoleFilter => {
            if (modRoleFilter != null) {
                return modRoleFilter.name === modRole.name;
            } else {
                return false;
            }
        }).length > 0) {
            return true;
        }else{
            return false;
        }
        
}

function getAllModules(workingCopy: OnlineWorkingCopy): projects.IModule[] {
    return workingCopy.model().allModules();
}

function processDomainModel(module: projects.IModule, role: security.UserRole): when.Promise<void> {
    return when.all<void>(module.domainModel.entities.map((entity) => checkEntity(entity)));
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




