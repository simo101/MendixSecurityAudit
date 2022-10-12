import { MendixPlatformClient, OnlineWorkingCopy} from "mendixplatformsdk";
import { ModelSdkClient, IModel, projects, domainmodels, microflows, pages, navigation, texts, security, IStructure, menus, IList } from "mendixmodelsdk";
const appId = "{{appID}}";
const branchName = null // null for mainline
const wc = null;
const client = new MendixPlatformClient();
var officegen = require('officegen');
var xlsx = officegen('xlsx');
var fs = require('fs');
var pObj;

const sheet = xlsx.makeNewSheet ();
sheet.name = 'Entities';

sheet.data[0]=[];
sheet.data[0][0] = `User Role`;
sheet.data[0][1] = `Module`;
sheet.data[0][2] = `Module Role`;
sheet.data[0][3] = `Entity`;
sheet.data[0][4] = `Xpath`;
sheet.data[0][5] = `Create/Delete`;
sheet.data[0][6] = `Member Rules`;

const sheetPages = xlsx.makeNewSheet ();
sheetPages.name = 'Pages';

sheetPages.data[0]=[];
sheetPages.data[0][0] = `User Role`;
sheetPages.data[0][1] = `Module`;
sheetPages.data[0][2] = `Module Role`;
sheetPages.data[0][3] = `Page Name`;
sheetPages.data[0][4] = `Allowed`;

const sheetMicroflows = xlsx.makeNewSheet ();
sheetMicroflows.name = 'Microflows';

sheetMicroflows.data[0]=[];
sheetMicroflows.data[0][0] = `User Role`;
sheetMicroflows.data[0][1] = `Module`;
sheetMicroflows.data[0][2] = `Module Role`;
sheetMicroflows.data[0][3] = `Microflows`;
sheetMicroflows.data[0][4] = `Allowed`;
  
/*
 * PROJECT TO ANALYZE
 */
const app = client.getApp(appId);
main();

process.on('unhandledRejection', (reason, promise) => {
  console.log('Unhandled Rejection at:', reason.stack || reason)
});

process.on('warning', (warning) => {
  console.warn(warning.name);    // Print the warning name
  console.warn(warning.message); // Print the warning message
  console.warn(warning.stack);   // Print the stack trace
});

async function main(){

    var repository = app.getRepository();
    var useBranch:string ="";

    if(branchName === null){
        var repositoryInfo = await repository.getInfo();
        if (repositoryInfo.type === `svn`)
            useBranch = `trunk`;
        else
            useBranch = `main`;
    }else{
        useBranch = branchName;
    }

    const workingCopy = await app.createTemporaryWorkingCopy(useBranch);

    const projectSecurity = await loadProjectSecurity(workingCopy);

    const userRoles = getAllUserRoles(projectSecurity);
    
    const securityDocument = await createUserSecurityDocument(userRoles);

    var out = await fs.createWriteStream('MendixSecurityDocument.xlsx');
    xlsx.generate(out);
    out.on('close', function () {
        console.log('Finished creating Document');
    });


}

/**
* This function picks the first navigation document in the project.
*/
async function createUserSecurityDocument(userRoles: security.UserRole[]){
    console.log("Creating User Access Matrix");
    await Promise.all(userRoles.map(async (userRole) => processAllModules(userRole)));
}

async function processAllModules(userRole: security.UserRole):Promise<void>{
    // console.debug("processAllModules");
    var modules = userRole.model.allModules();
    await Promise.all(modules.map(async (module) => processModule(module, userRole)));
}

async function processModule(module: projects.IModule, userRole: security.UserRole):Promise<void> {
    // console.debug(`Processing module: ${module.name}`);
    var securities = await getAllModuleSecurities(module);
    await Promise.all(securities.map(async (security) => loadAllModuleSecurities(securities,userRole)));
    
}
async function getAllModuleSecurities(module: projects.IModule): Promise<security.IModuleSecurity[]> {
    // console.debug(`Processing getAllModuleSecurities: ${module.name}`);
    return module.model.allModuleSecurities().filter(modSecurity => {
        if (modSecurity != null) {
			console.debug(`Mod Security is not null: ${modSecurity.containerAsModule.name}`);
            return modSecurity.containerAsModule.name === module.name;
        } else {
            return false;
        };

    });
}

async function loadAllModuleSecurities(moduleSecurities: security.IModuleSecurity[], userRole: security.UserRole):Promise<void>{
    await Promise.all(moduleSecurities.map(async (mSecurity) => processLoadedModSec(mSecurity,userRole)));
}

async function processLoadedModSec(modSec: security.IModuleSecurity, userRole: security.UserRole):Promise<void>{
    await Promise.all(modSec.moduleRoles.map(async (modRole) => processModRole(modRole,userRole)));
}



async function loadModSec(modSec: security.IModuleSecurity): Promise<security.ModuleSecurity> {
    // console.debug(`Processing loadModSec`);
    return modSec.load();
}



async function processModRole(modRole:security.IModuleRole, userRole:security.UserRole):Promise<void>{
    if(addIfModuleRoleInUserRole(modRole, userRole)){
        await Promise.all(modRole.containerAsModuleSecurity.containerAsModule.domainModel.entities.map(async (entity) =>
            processAllEntitySecurityRules(entity,modRole,userRole).then(()=> processAllPages(modRole,userRole)).then(()=>processAllMicroflows(modRole,userRole))));
    }

}
async function processAllEntitySecurityRules(entity:domainmodels.IEntity,moduleRole:security.IModuleRole,userRole:security.UserRole):Promise<void>{
    await entity.load().then(loadedEntity => 
        checkIfModuleRoleIsUsedForEntityRole(loadedEntity,loadedEntity.accessRules, moduleRole,userRole));
}

async function processAllPages(modRole:security.IModuleRole,userRole:security.UserRole):Promise<void>{
    await Promise.all(modRole.model.allPages().map(async (page) => processPage(modRole,userRole,page)));
}

async function processPage(modRole:security.IModuleRole, userRole:security.UserRole, page:pages.IPage):Promise<void>{
        await page.load().then(loadedPage =>addPage(modRole,userRole,loadedPage));       
}

function addPage(modRole:security.IModuleRole, userRole:security.UserRole, loadedPage:pages.Page){
	if(loadedPage.allowedRoles.filter(allowedRole => allowedRole.name == modRole.name).length > 0){
		sheetPages.data.push([`${userRole.name}`,`${modRole.containerAsModuleSecurity.containerAsModule.name}`,`${modRole.name}`,`${loadedPage.name}`,`True`]);
		// console.debug(`${userRole.name}`,`${modRole.containerAsModuleSecurity.containerAsModule.name}`,`${modRole.name}`,`${loadedPage.name}`,`True`);
		// console.debug(`Add page: ${modRole.name}`,`${userRole.name}`,`${modRole.containerAsModuleSecurity.containerAsModule.name}`);
	}else{
		sheetPages.data.push([`${userRole.name}`,`${modRole.containerAsModuleSecurity.containerAsModule.name}`,`${modRole.name}`,`${loadedPage.name}`,`False`]);
		// console.debug(`${userRole.name}`,`${modRole.containerAsModuleSecurity.containerAsModule.name}`,`${modRole.name}`,`${loadedPage.name}`,`False`);
	}
}



async function processAllMicroflows(modRole:security.IModuleRole,userRole:security.UserRole):Promise<void>{
    await Promise.all(modRole.model.allMicroflows().map(async (microflow) => processMicroflow(modRole,userRole,microflow)));
}

async function processMicroflow(modRole:security.IModuleRole, userRole:security.UserRole, microflow:microflows.IMicroflow):Promise<void>{
        await microflow.load().then(microflowLoaded => addMicroflow(modRole,userRole,microflowLoaded));
}
function addMicroflow(modRole:security.IModuleRole, userRole:security.UserRole, microflowLoaded:microflows.Microflow){
    if(microflowLoaded.allowedModuleRoles.filter(allowedRole => allowedRole.name == modRole.name).length > 0){
        sheetMicroflows.data.push([`${userRole.name}`,`${modRole.containerAsModuleSecurity.containerAsModule.name}`,`${modRole.name}`,`${microflowLoaded.name}`,`True`]);
        // console.debug(`${userRole.name}`,`${modRole.containerAsModuleSecurity.containerAsModule.name}`,`${modRole.name}`,`${microflowLoaded.name}`,`True`);
		// console.debug(`Add MF: ${modRole.name}`,`${userRole.name}`,`${modRole.containerAsModuleSecurity.containerAsModule.name}`);
    }else{
        sheetMicroflows.data.push([`${userRole.name}`,`${modRole.containerAsModuleSecurity.containerAsModule.name}`,`${modRole.name}`,`${microflowLoaded.name}`,`False`]);
        // console.debug(`${userRole.name}`,`${modRole.containerAsModuleSecurity.containerAsModule.name}`,`${modRole.name}`,`${microflowLoaded.name}`,`False`);
    }
}



async function checkIfModuleRoleIsUsedForEntityRole(entity:domainmodels.Entity,accessRules:domainmodels.AccessRule[], modRole:security.IModuleRole,userRole:security.UserRole):Promise<void>{
    await Promise.all(accessRules.map(async (rule) =>{
            var memberRules = ``;
            if(rule.moduleRoles.filter(entityModRule =>{
                return entityModRule.name === modRole.name;
            }).length > 0){
                    rule.memberAccesses.map( async (memRule) =>{
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
                sheet.data.push([`${userRole.name}`,`${entity.containerAsDomainModel.containerAsModule.name}`,`${modRole.name}`,`${entity.name}`,`${rule.xPathConstraint}`,`${createDelete}`,`${memberRules}`]);
                // console.debug(`${userRole.name},${entity.containerAsDomainModel.containerAsModule.name},${modRole.name},${entity.name},${rule.xPathConstraint},${createDelete},${memberRules}`);
            }
        }));
}

function addIfModuleRoleInUserRole(modRole: security.IModuleRole, userRole: security.UserRole): boolean{
        // console.debug(`Processing module role: ${modRole.name}`);
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

/**
* This function loads the project security.
*/
async function loadProjectSecurity(workingCopy: OnlineWorkingCopy): Promise<security.ProjectSecurity> {
    
    var model:IModel = await workingCopy.openModel();
    var security = model.allProjectSecurities()[0];
    return await security.load();
}

function getAllUserRoles(projectSecurity: security.ProjectSecurity): security.UserRole[] {
    console.log("All user roles retrieved");
    return projectSecurity.userRoles;
}