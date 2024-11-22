
import { ProjectInformation } from "../../Domain/ProductLineEngineering/Entities/ProjectInformation";
import { Adaptation } from "../../Domain/ProductLineEngineering/Entities/Adaptation";
import { Application } from "../../Domain/ProductLineEngineering/Entities/Application";
import { Model } from "../../Domain/ProductLineEngineering/Entities/Model";
import { ProductLine } from "../../Domain/ProductLineEngineering/Entities/ProductLine";
import { Project } from "../../Domain/ProductLineEngineering/Entities/Project";
import { Element } from "../../Domain/ProductLineEngineering/Entities/Element";
import { NewModelEventArg } from "./Events/NewModelEventArg";
import ProjectManager, {
  ModelLookupResult,
} from "../../Domain/ProductLineEngineering/UseCases/ProjectUseCases";
import { Language } from "../../Domain/ProductLineEngineering/Entities/Language";
import LanguageUseCases from "../../Domain/ProductLineEngineering/UseCases/LanguageUseCases";
import { SelectedModelEventArg } from "./Events/SelectedModelEventArg";
import { SelectedElementEventArg } from "./Events/SelectedElementEventArg";
import { UpdatedElementEventArg } from "./Events/UpdatedElementEventArg";
import { CreatedElementEventArg } from "./Events/CreatedElementEventArg";
import { LanguagesDetailEventArg } from "./Events/LanguagesDetailEventArg";
import { ProjectEventArg } from "./Events/ProjectEventArg";
import { NewProductLineEventArg } from "./Events/NewProductLineEventArg";
import { NewApplicationEventArg } from "./Events/NewApplicationEventArg";
import { NewAdaptationEventArg } from "./Events/NewAdaptationEventArg";
import { ExternalFuntion } from "../../Domain/ProductLineEngineering/Entities/ExternalFuntion";
import { Utils } from "../../Addons/Library/Utils/Utils";
import { Config } from "../../Config";
import { Relationship } from "../../Domain/ProductLineEngineering/Entities/Relationship";
import { Property } from "../../Domain/ProductLineEngineering/Entities/Property";
import { Point } from "../../Domain/ProductLineEngineering/Entities/Point";
import RestrictionsUseCases from "../../Domain/ProductLineEngineering/UseCases/RestrictionsUseCases";
import ProjectUseCases from "../../Domain/ProductLineEngineering/UseCases/ProjectUseCases";
import ProjectPersistenceUseCases from "../../Domain/ProductLineEngineering/UseCases/ProjectPersistenceUseCases";
import { isJSDocThisTag } from "typescript";
import * as alertify from "alertifyjs";
import { Buffer } from "buffer";
import { ConfigurationInformation } from "../../Domain/ProductLineEngineering/Entities/ConfigurationInformation";
import { Query } from "../../Domain/ProductLineEngineering/Entities/Query";
import { runQuery, runQueryFromModel } from "../../Domain/ProductLineEngineering/UseCases/QueryUseCases";
import QueryResult from "../../UI/Queries/queryResult";
import mx from "../../UI/MxGEditor/mxgraph";
import { v4 as uuidv4 } from 'uuid';
import socket from "../../Utils/Socket";

export default class ProjectService {
  private graph: any;
  public socket= socket;
  private clientId: string;
  public workspaceId: string;
  private projectCreated: boolean = false;
  private projectManager: ProjectManager = new ProjectManager();
  private languageUseCases: LanguageUseCases = new LanguageUseCases();
  private projectPersistenceUseCases: ProjectPersistenceUseCases = new ProjectPersistenceUseCases();
  private restrictionsUseCases: RestrictionsUseCases =
    new RestrictionsUseCases();

  private utils: Utils = new Utils();

  //Since we have no access to the current language,
  //We will need a parameter query when we need it
  // more and more it's clear we need redux or something like it
  // to manage the state of the application
  private _currentLanguage: Language = null;

  private _environment: string = Config.NODE_ENV;
  private _languages: any = this.getLanguagesByUser();
  private _externalFunctions: ExternalFuntion[] = [];
  private _project: Project = this.createProject("");
  private _projectInformation: ProjectInformation;
  private treeItemSelected: string = "";
  private treeIdItemSelected: string = "";
  private productLineSelected: number = 0;
  private applicationSelected: number = 0;
  private adaptationSelected: number = 0;

  private newProductLineListeners: any = [];
  private newApplicationListeners: any = [];
  private newAdaptationListeners: any = [];
  private newDomainEngineeringModelListeners: any = [];
  private newApplicationEngineeringModelListeners: any = [];
  private newApplicationModelListeners: any = [];
  private newAdaptationModelListeners: any = [];
  private selectedModelListeners: any = [];
  private loadLanguagesListeners: any = [];
  private updateProjectListeners: any = [];
  private updateSelectedListeners: any = [];
  private selectedElementListeners: any = [];
  private updatedElementListeners: any = [];
  private createdElementListeners: any = [];
  private requestSaveConfigurationListener: any = [];
  private requestOpenConfigurationListener: any = [];

  // constructor() {
  //   let me = this;
  //   let fun = function (data: any) {
  //     me._languages = data;
  //   };

  //   this.languageService.getLanguages(fun);
  // }

  constructor() {
    this.clientId = uuidv4();
    this.workspaceId = uuidv4();  // Genera un workspaceId único para cada usuario

    this.socket.on('connect', () => {
      console.log('Connected to collaboration server with ID:', this.clientId, 'Workspace ID:', this.workspaceId);
      this.socket.emit('registerWorkspace', { clientId: this.clientId, workspaceId: this.workspaceId });
  });
  this.socket.on('replaceProject', (data) => {
    console.log('Replacing project with data from server:', data.project);
  
    // Lógica para reemplazar el proyecto actual con el nuevo proyecto
    this.replaceProject(data.project);
  
    // Emitir un evento para que la UI u otros componentes sepan que el proyecto ha sido reemplazado
    this.raiseEventUpdateProject(this._project, null);
  });
  
    // Cliente: Escuchar la creación de Product Line retransmitida por el servidor
    this.socket.on('productLineCreated', (data) => {
      console.log('Received productLineCreated event:', data); // Verificar si el evento fue recibido
      if (data.workspaceId === this.workspaceId && data.clientId !== this.clientId) {
          console.log(`Processing productLineCreated for workspace ${data.workspaceId}`);
          this.handleProductLineCreated(data.projectId, data.productLine);
      } else {
          console.log('Ignored productLineCreated from clientId:', data.clientId); // Ignorar si el evento fue enviado por el propio cliente
      }
  });
  
    this.socket.on('modelCreated', (data) => {
      console.log('Received modelCreated event:', data); // Log para verificar si el modelo fue recibido
      if (data.workspaceId === this.workspaceId && data.clientId !== this.clientId) {
        console.log(`Processing modelCreated for workspace ${data.workspaceId}`);
        this.handleModelCreated(data.projectId, data.productLineId, data.model);
      } else {
        console.log('Ignored modelCreated from clientId:', data.clientId); // Log si el evento es ignorado por alguna razón
      }
    });
  
    this.socket.on('modelDeleted', (data) => {
      console.log('Received modelDeleted event:', data); // Log para verificar si el evento fue recibido
      if (data.workspaceId === this.workspaceId && data.clientId !== this.clientId) {
        console.log('Processing modelDeleted for workspace:', this.workspaceId);
        this.handleModelDeleted(data.modelId);
      } else {
        console.log('Ignored modelDeleted from clientId:', data.clientId); // Log si el evento es ignorado
      }
    });
  
    this.socket.on('modelRenamed', (data) => {
      console.log('Received modelRenamed event:', data); // Log para verificar si el evento fue recibido
      if (data.workspaceId === this.workspaceId && data.clientId !== this.clientId) {
        console.log('Processing modelRenamed for workspace:', this.workspaceId);
        this.handleModelRenamed(data.modelId, data.newName);
      } else {
        console.log('Ignored modelRenamed from clientId:', data.clientId); // Log si el evento es ignorado
      }
    });
  
    this.socket.on('modelConfigured', (data) => {
      console.log('Received modelConfigured event:', data); // Log para verificar si el evento fue recibido
      if (data.workspaceId === this.workspaceId && data.clientId !== this.clientId) {
        console.log('Processing modelConfigured for workspace:', this.workspaceId);
        this.handleModelConfigured(data.modelId, data.configuration);
      } else {
        console.log('Ignored modelConfigured from clientId:', data.clientId); // Log si el evento es ignorado
      }
    });
  
      this.socket.on('invitationReceived', (data) => {
        if (data.invitedUserEmail === this.getUserEmail()) {
            const accept = window.confirm(`${data.inviterName} te ha invitado a colaborar. ¿Aceptar?`);
            if (accept) {
                this.joinWorkspace(data.workspaceId);
            }
        }
    });
  
    }
  
    private replaceProject(newProject: Project): void {
      this._project = newProject;
      console.log('Project replaced with:', this._project);
    }
    
    getUserEmail(): string | null {
      const userProfile = JSON.parse(sessionStorage.getItem('CurrentUserProfile') || localStorage.getItem('CurrentUserProfile'));
      return userProfile ? userProfile.email : null;
  }
  
  setWorkspaceId(id: string) {
    this.workspaceId = id;
  }
  
  // Método para obtener el workspaceId actual
  getWorkspaceId() {
    return this.workspaceId;
  }
  
  public emitSocketEvent(event: string, data: any) {
    this.socket.emit(event, data);
  }
  
  public getSocket() {
    return this.socket;
  }
  
    public getClientId(): string {
      return this.clientId;
    }

  public get currentLanguage(): Language {
    return this._currentLanguage;
  }

  public get externalFunctions(): ExternalFuntion[] {
    return this._externalFunctions;
  }

  public get environment(): string {
    return this._environment;
  }

  public getProject(): Project {
    return this._project;
  }

  public getProjectInformation(): ProjectInformation {
    return this._projectInformation;
  }

  public setProjectInformation(projectInformation: ProjectInformation) {
    this._projectInformation = projectInformation;
  }

  public getProductLineSelected(): ProductLine {
    let i = this.productLineSelected;
    return this.project.productLines[i];
  }

  callExternalFuntion(
    externalFunction: ExternalFuntion,
    query: any,
    selectedElementsIds: string[],
    selectedRelationshipsIds: string[]
  ) {
    let me = this;

    // Standard Request Start
    externalFunction.request = {};

    //pack the semantics
    const semantics = me._languages.filter(
      (lang) => lang.id === externalFunction.language_id
    )[0].semantics;

    const data = {
      modelSelectedId: me.treeIdItemSelected,
      project: me._project,
      rules: semantics,
      selectedElementsIds: selectedElementsIds,
      selectedRelationshipsIds: selectedRelationshipsIds,
    };

    externalFunction.request = {
      transactionId: me.generateId(),
      data: !query ? data : { ...data, query },
    };
    // Standard Request End

    let callback = function (response: any) {
      //Decode content.
      //alert(JSON.stringify(response));
      if (externalFunction.resulting_action === "download") {
        let buffer = Buffer.from(response.data.content, "base64");
        response.data.content = buffer;
      } else if (response.data.name?.indexOf("json") > -1)
        response.data.content = JSON.parse(response.data.content);

      const resulting_action: any = {
        download: function () {
          me.utils.downloadBinaryFile(
            response.data.name,
            response.data.content
          );
        },
        showonscreen: function () {
          // alert(JSON.stringify(response.data.content));
          if ("error" in response.data) {
            alertify.error(response.data.error);
          } else {
            if (String(response.data.content).includes("(model")) {
              // alertify.alert("Model semantics", `${String(response.data.content)}`)
              alert(`${String(response.data.content)}`);
            } else {
              alertify.success(String(response.data.content));
            }
            // document.getElementById(me.treeIdItemSelected).click();
          }
        },
        updateproject: function () {
          if ("error" in response.data) {
            alertify.error(response.data.error);
          } else {
            me.updateProject(response.data.content, me.treeIdItemSelected);
            // document.getElementById(me.treeIdItemSelected).click();
          }
        },
      };
      //Set the resulting action to be conditional on the query itself
      //since we will have a single mechanism for making these queries
      // TODO: FIXME: This is a dirty hack...
      if (!query) {
        resulting_action[externalFunction.resulting_action]();
      } else {
        if (response.data.content?.productLines) {
          resulting_action["updateproject"]();
        } else {
          resulting_action["showonscreen"]();
        }
      }
    };
    alertify.success("request sent ...");
    me.languageUseCases.callExternalFuntion(callback, externalFunction);
  }

  loadExternalFunctions(languageName: string) {
    let me = this;
    let language = this._languages.filter(
      (language) => language.name == languageName
    );
    let callback = function (data: any) {
      me._externalFunctions = data;
    };
    if (language) {
      if (language.length > 0) {
        this.languageUseCases.getExternalFunctions(callback, language[0].id);
        // HACK: FIXME: This is a dirty hack...
        // We will se the current language to be the first one
        // so that we can get it instead of passing through a million different
        // functions
        this._currentLanguage = language[0];
      }
    }
  }

  //Search Model functions_ START***********
  modelDomainSelected(idPl: number, idDomainModel: number) {
    let modelSelected =
      this._project.productLines[idPl].domainEngineering?.models[idDomainModel];

    this.treeItemSelected = "model";
    this.treeIdItemSelected = modelSelected.id;

    this.loadExternalFunctions(modelSelected.type);

    this.raiseEventSelectedModel(modelSelected);
    this.raiseEventUpdateSelected(this.treeItemSelected);
  }

  modelApplicationEngSelected(idPl: number, idApplicationEngModel: number) {
    let modelSelected =
      this._project.productLines[idPl].applicationEngineering?.models[
      idApplicationEngModel
      ];
    this.treeItemSelected = "model";
    this.treeIdItemSelected = modelSelected.id;

    this.loadExternalFunctions(modelSelected.type);

    this.raiseEventSelectedModel(modelSelected);
    this.raiseEventUpdateSelected(this.treeItemSelected);
  }

  modelApplicationSelected(
    idPl: number,
    idApplication: number,
    idApplicationModel: number
  ) {
    let modelSelected =
      this._project.productLines[idPl].applicationEngineering?.applications[
        idApplication
      ].models[idApplicationModel];
    this.treeItemSelected = "model";
    this.treeIdItemSelected = modelSelected.id;

    this.loadExternalFunctions(modelSelected.type);

    this.raiseEventSelectedModel(modelSelected);
    this.raiseEventUpdateSelected(this.treeItemSelected);
  }

  modelAdaptationSelected(
    idPl: number,
    idApplication: number,
    idAdaptation: number,
    idAdaptationModel: number
  ) {
    let modelSelected =
      this._project.productLines[idPl].applicationEngineering?.applications[
        idApplication
      ].adaptations[idAdaptation].models[idAdaptationModel];

    this.treeItemSelected = "model";
    this.treeIdItemSelected = modelSelected.id;

    this.loadExternalFunctions(modelSelected.type);

    this.raiseEventSelectedModel(modelSelected);
    this.raiseEventUpdateSelected(this.treeItemSelected);
  }

  addSelectedModelListener(listener: any) {
    this.selectedModelListeners.push(listener);
  }

  removeSelectedModelListener(listener: any) {
    this.selectedModelListeners[listener] = null;
  }

  raiseEventSelectedModel(model: Model | undefined) {
    if (model) {
      let me = this;
      let e = new SelectedModelEventArg(me, model);
      for (let index = 0; index < me.selectedModelListeners.length; index++) {
        let callback = this.selectedModelListeners[index];
        callback(e);
      }
    }
  }

  addSelectedElementListener(listener: any) {
    this.selectedElementListeners.push(listener);
  }

  removeSelectedElementListener(listener: any) {
    this.selectedElementListeners[listener] = null;
  }

  raiseEventSelectedElement(
    model: Model | undefined,
    element: Element | undefined
  ) {
    let me = this;
    let e = new SelectedElementEventArg(me, model, element);
    for (let index = 0; index < me.selectedElementListeners.length; index++) {
      let callback = this.selectedElementListeners[index];
      callback(e);
    }
  }

  addUpdatedElementListener(listener: any) {
    this.updatedElementListeners.push(listener);
  }

  removeUpdatedElementListener(listener: any) {
    this.updatedElementListeners[listener] = null;
  }

  raiseEventUpdatedElement(
    model: Model | undefined,
    element: Element | undefined
  ) {
    let me = this;
    let e = new UpdatedElementEventArg(me, model, element);
    for (let index = 0; index < me.updatedElementListeners.length; index++) {
      let callback = this.updatedElementListeners[index];
      callback(e);
    }
  }

  addCreatedElementListener(listener: any) {
    this.createdElementListeners.push(listener);
  }

  removeCreatedElementListener(listener: any) {
    this.createdElementListeners[listener] = null;
  }

  raiseEventCreatedElement(
    model: Model | undefined,
    element: Element | undefined
  ) {
    let me = this;
    let e = new CreatedElementEventArg(me, model, element);
    for (let index = 0; index < me.createdElementListeners.length; index++) {
      let callback = this.createdElementListeners[index];
      callback(e);
    }
  }

  updateAdaptationSelected(
    idPl: number,
    idApplication: number,
    idAdaptation: number
  ) {
    this.productLineSelected = idPl;
    this.applicationSelected = idApplication;
    this.adaptationSelected = idAdaptation;
    this.treeItemSelected = "adaptation";
    this.treeIdItemSelected =
      this._project.productLines[idPl].applicationEngineering.applications[
        idApplication
      ].adaptations[idAdaptation].id;
    this.raiseEventUpdateSelected(this.treeItemSelected);
  }
  updateApplicationSelected(idPl: number, idApplication: number) {
    this.productLineSelected = idPl;
    this.applicationSelected = idApplication;
    this.treeItemSelected = "application";
    this.treeIdItemSelected =
      this._project.productLines[idPl].applicationEngineering.applications[
        idApplication
      ].id;
    this.raiseEventUpdateSelected(this.treeItemSelected);
  }
  updateLpSelected(idPl: number) {
    this.productLineSelected = idPl;
    this.treeItemSelected = "productLine";
    this.treeIdItemSelected = this._project.productLines[idPl].id;
    this.raiseEventUpdateSelected(this.treeItemSelected);
  }

  updateDomainEngSelected() {
    this.treeItemSelected = "domainEngineering";
    this.raiseEventUpdateSelected(this.treeItemSelected);
  }

  updateAppEngSelected() {
    this.treeItemSelected = "applicationEngineering";
    this.raiseEventUpdateSelected(this.treeItemSelected);
  }

  //Function ot get currently selected model
  getTreeIdItemSelected(): string {
    return this.treeIdItemSelected;
  }

  getTreeItemSelected() {
    return this.treeItemSelected;
  }

  setTreeItemSelected(value: string) {
    this.treeItemSelected = value;
  }

  addUpdateSelectedListener(listener: any) {
    this.updateSelectedListeners.push(listener);
  }

  removeUpdateSelectedListener(listener: any) {
    this.updateSelectedListeners[listener] = null;
  }

  raiseEventUpdateSelected(itemSelected: string) {
    let me = this;
    let e: string = itemSelected;
    for (let index = 0; index < me.updateSelectedListeners.length; index++) {
      let callback = this.updateSelectedListeners[index];
      callback(e);
    }
  }
  //Search Model functions_ END***********

  //Language functions_ START***********

  public get languages(): Language[] {
    return this._languages;
  }

  getUser() {
    let userId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    let databaseUserProfile = sessionStorage.getItem("databaseUserProfile");
    if (databaseUserProfile) {
      let data = JSON.parse(databaseUserProfile);
      userId = data.user.id;
    }
    if (userId == "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa") {
       //userId = "21cd2d82-1bbc-43e9-898a-d5a45abdeced";
    }
    return userId;
  }

  isGuessUser() {
    let userId = this.getUser();
    let guessUserId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    if (userId == guessUserId) {
      return true;
    } else {
      return false;
    }
  }

  getLanguagesByUser(): Language[] {
    let user = this.getUser();
    return this.languageUseCases.getLanguagesByUser(user);
  }

  getLanguagesDetail(): Language[] {
    return this.languageUseCases.getLanguagesDetail();
  }

  applyRestrictions(callback: any, model: Model) {
    let languageByName: Language = this.languageUseCases.getLanguageByName(
      model.type,
      this._languages
    );

    let restrictions: any =
      this.restrictionsUseCases.getRestrictions(languageByName);

    this.restrictionsUseCases.applyRestrictions(callback, model, restrictions);
  }

  getLanguagesDetailCll(callback: any) {
    return this.languageUseCases.getLanguagesDetailCll(callback);
  }

  createLanguage(callback: any, language: any) {
    let user = this.getUser();
    if (user) {
      language.abstractSyntax = JSON.parse(language.abstractSyntax);
      language.concreteSyntax = JSON.parse(language.concreteSyntax);
      language.semantics = JSON.parse(language.semantics);
      return this.languageUseCases.createLanguage(callback, language, user);
    }
  }

  updateLanguage(callback: any, language: any, languageId: string) {
    let user = this.getUser();
    if (user) {
      language.id = languageId;
      language.abstractSyntax = JSON.parse(language.abstractSyntax);
      language.concreteSyntax = JSON.parse(language.concreteSyntax);
      language.semantics = JSON.parse(language.semantics);
      return this.languageUseCases.updateLanguage(callback, language, user);
    }
  }

  deleteLanguage(callback: any, languageId: string) {
    let user = this.getUser();
    return this.languageUseCases.deleteLanguage(callback, languageId, user);
  }

  existDomainModel(language: string): boolean {
    let existModel = this._project.productLines[
      this.productLineSelected
    ].domainEngineering.models.filter((model) => model.type === language)[0];

    if (existModel) return true;

    return false;
  }

  existApplicaioninEngModel(language: string): boolean {
    let existModel = this._project.productLines[
      this.productLineSelected
    ].applicationEngineering.models.filter(
      (model) => model.type === language
    )[0];

    if (existModel) return true;

    return false;
  }

  existApplicaioninModel(language: string): boolean {
    let existModel = this._project.productLines[
      this.productLineSelected
    ].applicationEngineering.applications[
      this.applicationSelected
    ].models.filter((model) => model.type === language)[0];

    if (existModel) return true;

    return false;
  }

  existAdaptationModel(language: string): boolean {
    let existModel = this._project.productLines[
      this.productLineSelected
    ].applicationEngineering.applications[this.applicationSelected].adaptations[
      this.adaptationSelected
    ].models.filter((model) => model.type === language)[0];

    if (existModel) return true;

    return false;
  }

  addLanguagesDetailListener(listener: any) {
    this.loadLanguagesListeners.push(listener);
  }

  removeLanguagesDetailListener(listener: any) {
    this.loadLanguagesListeners[listener] = null;
  }

  raiseEventLanguagesDetail(language: Language[]) {
    let me = this;
    let e = new LanguagesDetailEventArg(me, language);
    for (let index = 0; index < me.loadLanguagesListeners.length; index++) {
      let callback = this.loadLanguagesListeners[index];
      callback(e);
    }
  }

  getLanguagesByType(languageType: string, _languages: Language[]): Language[] {
    return this.languageUseCases.getLanguagesByType(languageType, _languages);
  }

  languageExist(languageName: string): Boolean {
    return this.languageUseCases.getLanguageByName(
      languageName,
      this._languages
    )
      ? true
      : false;
  }

  //Language functions_ END***********

  //Project functions_ START***********
  public get project(): Project {
    return this._project;
  }

  public set project(value: Project) {
    this._project = value;
  }

  createNewProject(projectName: string, productLineName: string, type: string, domain: string) {
    let project = this.projectManager.createProject(projectName);
    this.createLPS(project, productLineName, type, domain);

    // Emitir evento de creación de proyecto para trabajo colaborativo
    this.emitProjectCreated(project);

    // Marcar que el proyecto ha sido creado
    this.projectCreated = true;
    
     // Emitir evento para informar a la UI sobre el cambio
    this.raiseProjectCreatedEvent();

    return project;
}

public isProjectCreated(): boolean {
  return this.projectCreated;
}

private raiseProjectCreatedEvent() {
  // Emitir evento para que la UI sepa que un proyecto ha sido creado
  const event = new CustomEvent('projectCreated', { detail: { projectCreated: this.projectCreated } });
  window.dispatchEvent(event);  // Enviar el evento globalmente
}

  createProject(projectName: string): Project {
    let project = this.projectManager.createProject(projectName);
    console.log(`Proyecto creado: ID: ${project.id}, Nombre: ${project.name}`);
    project = this.loadProject(project);
    console.log(`Proyecto cargado: ID: ${project.id}, Nombre: ${project.name}`);
    this.emitProjectCreated(project);
    return project;
  }

  private emitProjectCreated(project: Project) {
    this.socket.emit('projectCreated', {
        clientId: this.clientId,
        workspaceId: this.workspaceId,
        project
    });
}
  
  inviteUserToWorkspace(invitedUserEmail: string) {
    this.socket.emit('inviteUser', {
        workspaceId: this.workspaceId,
        invitedUserEmail,
    });
}

joinWorkspace(workspaceId: string) {
  this.setWorkspaceId(workspaceId);
  this.socket.emit('joinWorkspace', { clientId: this.clientId, workspaceId: this.workspaceId });
  console.log(`joinWorkspace emitted with clientId: ${this.clientId} and workspaceId: ${workspaceId}`);
  if (this._project && this._project.id === 'my_project_id') { // Aquí puedes verificar que sea el proyecto por defecto
    this.emitProjectCreated(this._project); // Enviar el proyecto a los otros usuarios
  }
}

  //This gets called when one uploads a project file
  //It takes as the parameters the file one selects from the
  //dialog
  importProject(file: string | undefined): void {
    console.log(file);
    if (file) {
      this._project = Object.assign(this._project, JSON.parse(file));
      this._projectInformation = new ProjectInformation(null, this._project.name, null, false, null, null, null, new Date());
    }
    this.raiseEventUpdateProject(this._project, null);
  }

  updateProject(project: Project, modelSelectedId: string): void {
    this._project = project;
    this.raiseEventUpdateProject(this._project, modelSelectedId);
    //find the model selected
    //By default, only a single product line is supported
  }

  loadProject(project: Project): Project {
    let projectSessionStorage = sessionStorage.getItem("Project");
    if (projectSessionStorage) {
      project = Object.assign(project, JSON.parse(projectSessionStorage));
    }

    return project;
  }

  openProjectInServer(projectId: string, template: boolean): void {
    let me = this;
    let user = this.getUser();

    let openProjectInServerSuccessCallback = (projectInformation: ProjectInformation) => {
      me._project = projectInformation.project;
      me._projectInformation = projectInformation;
      if (template) {
        me._projectInformation.id = null;
        me._projectInformation.template = false;
      }
      me.raiseEventUpdateProject(me._project, null);
    }

    let openProjectInServerErrorCallback = (e) => {
      alert(JSON.stringify(e));
    }

    this.projectPersistenceUseCases.openProject(user, projectId, openProjectInServerSuccessCallback, openProjectInServerErrorCallback);
  }

  saveProjectInServer(projectInformation: ProjectInformation, successCallback: any, errorCallback: any): void {
    let me = this;
    let user = this.getUser();
    projectInformation.project = this._project;

    let sc = (e) => {
      me._projectInformation = e;
      if (successCallback) {
        successCallback(e);
      }
    }
    this.projectPersistenceUseCases.saveProject(user, projectInformation, sc, errorCallback);
  }

  deleteProjectInServer(projectInformation: ProjectInformation, successCallback: any, errorCallback: any): void {
    let me = this;
    let user = this.getUser();

    let sc = (e) => {
      me._projectInformation = e;
      if (successCallback) {
        successCallback(e);
      }
    }
    this.projectPersistenceUseCases.deleteProject(user, projectInformation, sc, errorCallback);
  }

  saveConfigurationInServer(configurationInformation: ConfigurationInformation, successCallback: any, errorCallback: any): void {
    let me = this;
    let user = this.getUser();

    let projectInformation = this.getProjectInformation();
    if (!projectInformation) {
      return;
    }

    configurationInformation.id_feature_model = this.treeIdItemSelected;
    configurationInformation.project_json = this._project;

    let sc = (e) => {
      if (successCallback) {
        successCallback(e);
      }
    }
    this.projectPersistenceUseCases.addConfiguration(user, projectInformation, configurationInformation, sc, errorCallback);
  }

  getProjectsByUser(successCallback: any, errorCallback: any) {
    let user = this.getUser();
    this.projectPersistenceUseCases.getProjectsByUser(user, successCallback, errorCallback);
  }

  getTemplateProjects(successCallback: any, errorCallback: any) {
    let user = this.getUser();
    this.projectPersistenceUseCases.getTemplateProjects(user, successCallback, errorCallback);
  }


  getAllConfigurations(successCallback: any, errorCallback: any) {
    let me = this;
    let user = this.getUser();
    let projectInformation = this.getProjectInformation();
    if (!projectInformation) {
      return;
    }
    let configurationInformation = new ConfigurationInformation(null, null, this.treeIdItemSelected, null);
    this.projectPersistenceUseCases.getAllConfigurations(user, projectInformation, configurationInformation, successCallback, errorCallback);
  }

  applyConfigurationInServer(configurationId: string,): void {
    let me = this;
    let user = this.getUser();
    let projectInformation = this.getProjectInformation();
    if (!projectInformation) {
      return;
    }
    let modelId = this.treeIdItemSelected;
    let configurationInformation = new ConfigurationInformation(configurationId, null, modelId, null);

    let successCallback = (project: Project) => {
      let configuredModel: Model = this.findModelById(project, modelId);
      let targetModel: Model = this.findModelById(me._project, modelId);
      targetModel.elements = configuredModel.elements;
      targetModel.relationships = configuredModel.relationships;
      me.raiseEventUpdateProject(this._project, modelId);
    }

    let errorCallback = (e) => {
      alert(JSON.stringify(e));
    }

    this.projectPersistenceUseCases.applyConfiguration(user, projectInformation, configurationInformation, successCallback, errorCallback);
  }

  deleteConfigurationInServer(configurationId: string,): void {
    let me = this;
    let user = this.getUser();
    let projectInformation = this.getProjectInformation();
    if (!projectInformation) {
      return;
    }
    let modelId = this.treeIdItemSelected;
    let configurationInformation = new ConfigurationInformation(configurationId, null, modelId, null);

    let successCallback = (project: Project) => {
      let x = 0;
      // let configuredModel: Model = this.findModelById(project, modelId);
      // let targetModel: Model = this.findModelById(me._project, modelId);
      // targetModel.elements = configuredModel.elements;
      // targetModel.relationships = configuredModel.relationships;
      // me.raiseEventUpdateProject(this._project, modelId);
    }

    let errorCallback = (e) => {
      alert(JSON.stringify(e));
    }

    this.projectPersistenceUseCases.deleteConfiguration(user, projectInformation, configurationInformation, successCallback, errorCallback);
  }

  saveProject(): void {
    this.projectManager.saveProject(this._project);
  }

  deleteProject(): void {
    this.projectManager.deleteProject();
    window.location.reload();
  }

  exportProject() {
    this.utils.downloadFile(this._project.name + ".json", this._project);
  }

  deleteItemProject() {
    this._project = this.projectManager.deleteItemProject(
      this._project,
      this.treeIdItemSelected
    );
    this.emitModelDeleted(this.treeIdItemSelected);
    this.raiseEventUpdateProject(this._project, null);
  }


  refreshLanguageList() {
    this._languages = this.getLanguagesByUser();
    this.raiseEventLanguagesDetail(this._languages);
  }

  renameItemProject(newName: string) {
    this._project = this.projectManager.renameItemProject(
      this._project,
      this.treeIdItemSelected,
      newName
    );
    this.emitModelRenamed(this.treeIdItemSelected, newName);
    this.raiseEventUpdateProject(this._project, this.treeIdItemSelected);
  }

  getItemProjectName() {
    return this.projectManager.getItemProjectName(
      this._project,
      this.treeIdItemSelected
    );
  }

  updateProjectState(state: boolean) {
    this._project.enable = state;
    this.raiseEventUpdateProject(this._project, this.treeIdItemSelected);
  }

  updateProjectName(name: string) {
    this._project.name = name;
    this.raiseEventUpdateProject(this._project, this.treeIdItemSelected);
  }

  addUpdateProjectListener(listener: any) {
    this.updateProjectListeners.push(listener);
  }

  removeUpdateProjectListener(listener: any) {
    this.updateProjectListeners[listener] = null;
  }

  raiseEventUpdateProject(project: Project, modelSelectedId: string) {
    let me = this;
    let e = new ProjectEventArg(me, project, modelSelectedId);
    for (let index = 0; index < me.updateProjectListeners.length; index++) {
      let callback = this.updateProjectListeners[index];
      callback(e);
    }
  }

  addRequestSaveConfigurationListener(listener: any) {
    this.requestSaveConfigurationListener.push(listener);
  }

  removeRequestSaveConfigurationListener(listener: any) {
    this.requestSaveConfigurationListener[listener] = null;
  }

  raiseEventRequestSaveConfigurationListener(project: Project, modelSelectedId: string) {
    let me = this;
    let e = new ProjectEventArg(me, project, modelSelectedId);
    for (let index = 0; index < me.requestSaveConfigurationListener.length; index++) {
      let callback = this.requestSaveConfigurationListener[index];
      callback(e);
    }
  }

  addRequestOpenConfigurationListener(listener: any) {
    this.requestOpenConfigurationListener.push(listener);
  }

  removeRequestOpenConfigurationListener(listener: any) {
    this.requestOpenConfigurationListener[listener] = null;
  }

  raiseEventRequestOpenConfigurationListener(project: Project, modelSelectedId: string) {
    let me = this;
    let e = new ProjectEventArg(me, project, modelSelectedId);
    for (let index = 0; index < me.requestOpenConfigurationListener.length; index++) {
      let callback = this.requestOpenConfigurationListener[index];
      callback(e);
    }
  }
  //Project functions_ END***********

  //Product Line functions_ START***********
  createLPS(project: Project, productLineName: string, type: string, domain: string): ProductLine {
    let productLine = this.projectManager.createLps(project, productLineName, type, domain);

    // Emitir evento de creación de LPS para trabajo colaborativo
    this.emitProductLineCreated(project.id, productLine);

    return productLine;
}

private emitProductLineCreated(projectId: string, productLine: ProductLine) {
  if (!projectId) {
      console.error('Error: Project ID is missing. Cannot emit productLineCreated event.');
      return;
  }
  console.log('Emitting productLineCreated event for project:', projectId, productLine);
  this.socket.emit('productLineCreated', {
      clientId: this.clientId,
      workspaceId: this.workspaceId,
      projectId: projectId,
      productLine
  });
}


private handleProductLineCreated(projectId: string, productLine: ProductLine) {
  console.log('Adding productLine to the project:', projectId, productLine);

  const project = this._project;
  if (project && project.id === projectId) {
     project.productLines.push(productLine);
     console.log('ProductLine added, raising event to update UI');

     // Asegurarse de levantar el evento para refrescar la UI
     this.raiseEventNewProductLine(productLine);
  } else {
     console.error('Project not found or ID mismatch');
  }
}

  addNewProductLineListener(listener: any) {
    this.newProductLineListeners.push(listener);
  }

  removeNewProductLineListener(listener: any) {
    this.newProductLineListeners[listener] = null;
  }

  raiseEventNewProductLine(productLine: ProductLine) {
    let me = this;
    let e = new NewProductLineEventArg(me, me._project, productLine);
    for (let index = 0; index < me.newProductLineListeners.length; index++) {
      let callback = this.newProductLineListeners[index];
      callback(e);
    }
  }
  //Product Line functions_ END***********

  //Application functions_ START***********
  createApplication(project: Project, applicationName: string) {
    return this.projectManager.createApplication(
      project,
      applicationName,
      this.productLineSelected
    );
  }

  addNewApplicationListener(listener: any) {
    this.newApplicationListeners.push(listener);
  }

  removeNewApplicationListener(listener: any) {
    this.newApplicationListeners[listener] = null;
  }

  raiseEventApplication(application: Application) {
    let me = this;
    let e = new NewApplicationEventArg(me, me._project, application);
    for (let index = 0; index < me.newApplicationListeners.length; index++) {
      let callback = this.newApplicationListeners[index];
      callback(e);
    }
  }
  //Application functions_ END***********

  //Adaptation functions_ START***********
  createAdaptation(project: Project, adaptationName: string) {
    return this.projectManager.createAdaptation(
      project,
      adaptationName,
      this.productLineSelected,
      this.applicationSelected
    );
  }

  addNewAdaptationListener(listener: any) {
    this.newAdaptationListeners.push(listener);
  }

  removeNewAdaptationListener(listener: any) {
    this.newAdaptationListeners[listener] = null;
  }

  raiseEventAdaptation(adaptation: Adaptation) {
    let me = this;
    let e = new NewAdaptationEventArg(me, me._project, adaptation);
    for (let index = 0; index < me.newAdaptationListeners.length; index++) {
      let callback = this.newAdaptationListeners[index];
      callback(e);
    }
  }
  //Adaptation functions_ END***********

  //createDomainEngineeringModel functions_ START***********
  createDomainEngineeringModel(project: Project, languageType: string, name: string) {
    const newModel = this.projectManager.createDomainEngineeringModel(project, languageType, this.productLineSelected, name);
    console.log(`Domain Engineering Model created: ${newModel.name} (ID: ${newModel.id}), Language Type: ${languageType}`);
    this.emitModelCreated(newModel);
    return newModel;
  }


  addNewDomainEngineeringModelListener(listener: any) {
    this.newDomainEngineeringModelListeners.push(listener);
  }

  removeNewDomainEngineeringModelListener(listener: any) {
    this.newDomainEngineeringModelListeners[listener] = null;
  }

  raiseEventDomainEngineeringModel(model: Model) {
    let me = this;
    let e = new NewModelEventArg(me, me._project, model);
    for (
      let index = 0;
      index < me.newDomainEngineeringModelListeners.length;
      index++
    ) {
      let callback = this.newDomainEngineeringModelListeners[index];
      callback(e);
    }
  }
  //createDomainEngineeringModel functions_ END***********

  //createApplicationEngineeringModel functions_ START***********
  createApplicationEngineeringModel(project: Project, languageType: string, name: string) {
    const newModel = this.projectManager.createApplicationEngineeringModel(project, languageType, this.productLineSelected, name);
    console.log(`Application Engineering Model created: ${newModel.name} (ID: ${newModel.id}), Language Type: ${languageType}`);
    this.emitModelCreated(newModel);
    return newModel;
  }


  addNewApplicationEngineeringModelListener(listener: any) {
    this.newApplicationEngineeringModelListeners.push(listener);
  }

  removeNewApplicationEngineeringModelListener(listener: any) {
    this.newApplicationEngineeringModelListeners[listener] = null;
  }

  raiseEventApplicationEngineeringModel(model: Model) {
    let me = this;
    let e = new NewModelEventArg(me, me._project, model);
    for (
      let index = 0;
      index < me.newApplicationEngineeringModelListeners.length;
      index++
    ) {
      let callback = this.newApplicationEngineeringModelListeners[index];
      callback(e);
    }
  }
  //createApplicationEngineeringModel functions_ END***********

  //createApplicationModel functions_ START***********
  createApplicationModel(project: Project, languageType: string, name: string) {
    const newModel = this.projectManager.createApplicationModel(project, languageType, this.productLineSelected, this.applicationSelected, name);
    this.emitModelCreated(newModel);
    return newModel;
  }
  addNewApplicationModelListener(listener: any) {
    this.newApplicationModelListeners.push(listener);
  }

  removeNewApplicationModelListener(listener: any) {
    this.newApplicationModelListeners[listener] = null;
  }

  raiseEventApplicationModelModel(model: Model) {
    let me = this;
    let e = new NewModelEventArg(me, me._project, model);
    for (
      let index = 0;
      index < me.newApplicationModelListeners.length;
      index++
    ) {
      let callback = this.newApplicationModelListeners[index];
      callback(e);
    }
  }
  //createApplicationModel functions_ END***********

  //createAdaptationModel functions_ START***********
  createAdaptationModel(project: Project, languageType: string, name: string) {
    const newModel = this.projectManager.createAdaptationModel(project, languageType, this.productLineSelected, this.applicationSelected, this.adaptationSelected, name);
    this.emitModelCreated(newModel);
    return newModel;
  }

  private emitModelCreated(model: Model) {
    console.log('Emitting modelCreated event:', { clientId: this.clientId, workspaceId: this.workspaceId, projectId: this._project.id, productLineId: this._project.productLines[this.productLineSelected].id, model});
    this.socket.emit('modelCreated', { clientId: this.clientId, workspaceId: this.workspaceId, projectId: this._project.id, productLineId: this._project.productLines[this.productLineSelected].id, model });
  }

  private handleModelCreated(projectId: string, productLineId: string, model: Model) {
    const project = this._project;
    const productLine = project.productLines.find(pl => pl.id === productLineId);

    if (productLine) {
        // Verificar si el modelo pertenece a domainEngineering
        if (productLine.domainEngineering) {
            productLine.domainEngineering.models.push(model);
            this.raiseEventDomainEngineeringModel(model);
        }
        // Verificar si el modelo pertenece a applicationEngineering
        else if (productLine.applicationEngineering) {
            // Intentar encontrar el application correspondiente a este model
            const application = productLine.applicationEngineering.applications.find(app => {
                return app.models.some(m => m.id === model.id); // Verifica si el modelo ya pertenece a una aplicación
            });

            if (application) {
                application.models.push(model);
                this.raiseEventApplicationModelModel(model);
            }
            // Verificar si pertenece a una adaptación
            else {
                const adaptation = productLine.applicationEngineering.applications
                    .flatMap(app => app.adaptations)  // Obtener todas las adaptaciones de todas las aplicaciones
                    .find(adapt => adapt.models.some(m => m.id === model.id));  // Verifica si el modelo ya pertenece a una adaptación

                if (adaptation) {
                    adaptation.models.push(model);
                    this.raiseEventAdaptationModelModel(model);
                } else {
                    console.error('Neither application nor adaptation found for model', model.id);
                }
            }
        } else {
            console.error('No domainEngineering or applicationEngineering found in the productLine');
        }
    } else {
        console.error('Product line not found for projectId:', projectId, 'and productLineId:', productLineId);
    }
}
  
  private emitModelDeleted(modelId: string) {
    console.log('Emitting modelDeleted event:', { clientId: this.clientId, workspaceId: this.workspaceId, projectId: this._project.id, productLineId: this._project.productLines[this.productLineSelected].id, modelId });
    this.socket.emit('modelDeleted', {
      clientId: this.clientId,
      workspaceId: this.workspaceId,
      projectId: this._project.id, 
      productLineId: this._project.productLines[this.productLineSelected].id,
      modelId
    });
  }

  private handleModelDeleted(itemId: string) {
    this._project = this.projectManager.deleteItemProject(
      this._project,
      itemId
    );
    this.raiseEventUpdateProject(this._project, null);
  }

  private emitModelRenamed(modelId: string, newName: string) {
    console.log('Emitting modelRenamed event:', { clientId: this.clientId, workspaceId: this.workspaceId, projectId: this._project.id, productLineId: this._project.productLines[this.productLineSelected].id, modelId, newName,});
    this.socket.emit('modelRenamed', {
      clientId: this.clientId,
      workspaceId: this.workspaceId,
      projectId: this._project.id, 
      productLineId: this._project.productLines[this.productLineSelected].id,
      modelId,
      newName,
    });
  }
  
  private handleModelRenamed(modelId: string, newName: string) {
    // Primero, verificar si el ID corresponde a un productLine
    this._project.productLines.forEach(productLine => {
      if (productLine.id === modelId) {
        // Si es un productLine, renombrarlo
        productLine.name = newName;
      }
  
      // Renombrar los modelos dentro de domainEngineering
      productLine.domainEngineering.models.forEach(model => {
        if (model.id === modelId) {
          model.name = newName;
        }
      });
  
      // Renombrar los modelos dentro de applicationEngineering
      productLine.applicationEngineering.models.forEach(model => {
        if (model.id === modelId) {
          model.name = newName;
        }
      });
  
      // Renombrar los modelos dentro de applications
      productLine.applicationEngineering.applications.forEach(application => {
        application.models.forEach(model => {
          if (model.id === modelId) {
            model.name = newName;
          }
        });
  
        // Renombrar los modelos dentro de adaptations
        application.adaptations.forEach(adaptation => {
          adaptation.models.forEach(model => {
            if (model.id === modelId) {
              model.name = newName;
            }
          });
        });
      });
    });
  
    // Levantar el evento para notificar que el proyecto ha sido actualizado
    this.raiseEventUpdateProject(this._project, modelId);
  }
  
  private emitModelConfigured(modelId: string, configuration: Model) {
    console.log('Emitting modelConfigured event:', { clientId: this.clientId, workspaceId: this.workspaceId, projectId: this._project.id, productLineId: this._project.productLines[this.productLineSelected].id, modelId, configuration });
    this.socket.emit('modelConfigured', { clientId: this.clientId, workspaceId: this.workspaceId, projectId: this._project.id, productLineId: this._project.productLines[this.productLineSelected].id, modelId, configuration });
  }

  private handleModelConfigured(modelId: string, configuration: Model) {
    let targetModel: Model = this.findModelById(this._project, modelId);
    targetModel.elements = configuration.elements;
    targetModel.relationships = configuration.relationships;
    this.raiseEventUpdateProject(this._project, modelId);
  }

  addNewAdaptationModelListener(listener: any) {
    this.newAdaptationModelListeners.push(listener);
  }

  removeNewAdaptationModelListener(listener: any) {
    this.newAdaptationModelListeners[listener] = null;
  }

  raiseEventAdaptationModelModel(model: Model) {
    let me = this;
    let e = new NewModelEventArg(me, me._project, model);
    for (
      let index = 0;
      index < me.newAdaptationModelListeners.length;
      index++
    ) {
      let callback = this.newAdaptationModelListeners[index];
      callback(e);
    }
  }
  //createAdaptationModel functions_ END***********

  //createApplicationEngineeringModel functions_ START***********

  //createApplicationEngineeringModel functions_ END***********

  setGraph(graph: any) {
    this.graph = graph;
  }

  getGraph() {
    return this.graph;
  }

  open() {
    //open file
  }

  duplicateObject(obj: any) {
    let str = JSON.stringify(obj);
    return JSON.parse(str);
  }

  getStyleDefinition(language: string, callBack: any) {
    if (this.languages) {
      for (let index = 0; index < this.languages.length; index++) {
        if (this.languages[index].name === language) {
          callBack(this.languages[index]);
        }
      }
    }
  }

  getLanguageDefinition(language: string) {
    if (this.languages) {
      for (let index = 0; index < this.languages.length; index++) {
        if (this.languages[index].name === language) {
          return this.languages[index];
        }
      }
    }
  }

  // getLanguagesByType(language: string) {
  //   if (this.languages) {
  //     for (let index = 0; index < this.languages.length; index++) {
  //       if (this.languages[index].name === language) {
  //         return this.languages[index];
  //       }
  //     }
  //   }
  // }

  createRelationship(
    model: Model,
    name: string,
    type: string,
    sourceId: string,
    targetId: string,
    points: Point[] = [],
    min: number,
    max: number,
    properties: Property[]
  ): Relationship {
    let r = this.projectManager.createRelationship(
      model,
      name,
      type,
      sourceId,
      targetId,
      points,
      min,
      max,
      properties
    );
    return r;
  }

  findModelById(project: Project, uid: any) {
    return ProjectUseCases.findModelById(project, uid);
  }

  findModelElementById(model: Model, uid: any) {
    return ProjectUseCases.findModelElementById(model, uid);
  }

  findModelElementByName(model: Model, name: any) {
    return ProjectUseCases.findModelElementByName(model, name);
  }

  findModelRelationshipById(model: Model, uid: any) {
    return ProjectUseCases.findModelRelationshipById(model, uid);
  }

  removeModelElementById(model: Model, uid: any) {
    return ProjectUseCases.removeModelElementById(model, uid);
  }

  removeModelRelationshipById(model: Model, uid: any) {
    return ProjectUseCases.removeModelRelationshipById(model, uid);
  }

  removeModelRelationshipsOfElement(model: Model, uid: any) {
    return ProjectUseCases.removeModelRelationshipsOfElement(model, uid);
  }

  findModelByName(type: string, modelName: string, neightborModel: Model) {
    return ProjectUseCases.findModelByName(
      this._project,
      type,
      modelName,
      neightborModel.id
    );
  }

  findModelElementByIdInProject(elementId: string) {
    return ProjectUseCases.findModelElementByIdInProject(
      this._project,
      elementId
    );
  }

  findModelElementPropertyByIdInProject(propertyId: string) {
    return ProjectUseCases.findModelElementPropertyByIdInProject(
      this._project,
      propertyId
    );
  }

  generateId() {
    return ProjectUseCases.generateId();
  }

  visualizeModel() { }

  //This function updates the selection status of the model
  //elements based on an incoming configuration under the form
  //of a project.
  //It is used when we call the translator from the UI
  updateSelection(projectInResponse: Project, modelSelectedId: string) {
    const modelLookupResult = this.projectManager.updateSelection(
      this._project,
      projectInResponse,
      modelSelectedId
    );
    this.reSelectModel(modelLookupResult);
  }

  //Reset the selection on the currently selected model
  resetModelConfig() {
    const modelLookupResult = this.projectManager.findModel(
      this._project,
      this.getTreeIdItemSelected()
    );
    if (modelLookupResult) {
      this.projectManager.resetSelection(modelLookupResult);
      // We should have the enum available here
      this.reSelectModel(modelLookupResult);
    }
  }

  lookupAndReselectModel() {
    const modelLookupResult = this.projectManager.findModel(
      this._project,
      this.getTreeIdItemSelected()
    );
    if (modelLookupResult) {
      this.reSelectModel(modelLookupResult);
    }
  }

  reSelectModel(modelLookupResult: ModelLookupResult) {
    switch (modelLookupResult.modelType) {
      case "Domain":
        this.modelDomainSelected(
          modelLookupResult.plIdx,
          modelLookupResult.modelIdx
        );
        break;
      case "Application":
        this.modelApplicationSelected(
          modelLookupResult.plIdx,
          modelLookupResult.appIdx,
          modelLookupResult.modelIdx
        );
        break;
      case "Adaptation":
        this.modelAdaptationSelected(
          modelLookupResult.plIdx,
          modelLookupResult.appIdx,
          modelLookupResult.adapIdx,
          modelLookupResult.modelIdx
        );
        break;
      case "ApplicationEng":
        this.modelApplicationEngSelected(
          modelLookupResult.plIdx,
          modelLookupResult.modelIdx
        );
        break;
      default:
        console.error("Unknown model type: " + modelLookupResult.modelType);
        console.error("could not reset model config");
        break;
    }
  }

  getProductLineDomainsList() {
    let list = [
      "Advertising and Marketing",
      "Agriculture",
      "Architecture and Design",
      "Art and Culture",
      "Automotive",
      "Beauty and Wellness",
      "Childcare and Parenting",
      "Construction",
      "Consulting and Professional Services",
      "E-commerce",
      "Education",
      "Energy and Utilities",
      "Environmental Services",
      "Event Planning and Management",
      "Fashion and Apparel",
      "Finance and Banking",
      "Food and Beverage",
      "Gaming and Gambling",
      "Government and Public Sector",
      "Healthcare",
      "Hospitality and Tourism",
      "Insurance",
      "Legal Services",
      "Manufacturing",
      "Media and Entertainment",
      "Non-profit and Social Services",
      "Pharmaceuticals",
      "Photography and Videography",
      "Printing and Publishing",
      "Real Estate",
      "Research and Development",
      "Retail",
      "Security and Surveillance",
      "Software and Web Development",
      "Sports and Recreation",
      "Telecommunications",
      "Transportation and Logistics",
      "Travel and Leisure",
      "Wholesale and Distribution",
      "IoT",
      "IndustrialControlSystems",
      "HealthCare",
      "Communication",
      "Military",
      "WebServices",
      "Transportation",
      "SmartPhones",
      "PublicAdministration",
      "Multi-Domain",
      "Banking",
      "EmergencyServices",
      "Cloud-Provider",
    ];
    return list;
  }

  getProductLineTypesList() {
    let list = ["Software", "System"];
    return list;
  }

  generateName(model: Model, type: string) {
    for (let i = 1; i < 100000000; i++) {
      let name = type + " " + i;
      let element = this.findModelElementByName(model, name);
      if (!element) {
        return name;
      }
    }
    return this.generateId();
  }

  resetConfiguration(model: Model) {
    ProjectUseCases.resetConfiguration(model);
    this.raiseEventUpdateProject(this._project, model.id);
  }

  async solveConsistency(appModel: Model) {
    const domainModel = this.project.productLines[0].domainEngineering.models[0];
    const domainElementsBackup = JSON.stringify(domainModel.elements);
    const getAppFeaturesId = appModel.elements.map(element => element.name)
    domainModel.elements.forEach((domElement) => {
      if(domElement.type === "ConcreteFeature" || domElement.type === "RootFeature") {
      if (getAppFeaturesId.includes(domElement.name)) {
        domElement.properties[0].value = "Selected";
      } else {
        domElement.properties[0].value = "Unselected";
      }
    }
    })
    const query_object = new Query({
      solver: "swi",
      operation: "sat"
    });
    const result = await runQueryFromModel(
      this,
      "https://app.variamos.com/semantic_translator",
      query_object,
      appModel.sourceModelIds[0]
    );
    domainModel.elements = JSON.parse(domainElementsBackup);
    console.log(result);
    appModel.inconsistent = !result;
    if (result) {
      alertify.success(`${appModel.name} is consistent with the domain model.`, 0);
      appModel.consistencyError = null;
    } else {
      const errorMessage = `${appModel.name} is not consistent with the domain model.`;
      appModel.consistencyError = errorMessage;
      alertify.error(errorMessage, 0);

    }
    this.raiseEventUpdateProject(this._project, appModel.id);
  }

  async solveConsistencyForAll(domainModel: Model) {
    const appModels = this.project.productLines[0].applicationEngineering.applications.flatMap(app => {
      return app.models.filter(model => model.sourceModelIds && model.sourceModelIds[0] === domainModel.id);
    });
    const domainElementsBackup = JSON.stringify(domainModel.elements);
    appModels.forEach(async appModel => {
      const getAppFeaturesId = appModel.elements.map(element => element.name)
      domainModel.elements.forEach((domElement) => {
        console.log(domElement)
        if(domElement.type === "ConcreteFeature" || domElement.type === "RootFeature") {
        if (getAppFeaturesId.includes(domElement.name)) {
          domElement.properties[0].value = "Selected";
        } else {
          domElement.properties[0].value = "Unselected";
        }
      }
      })
      const query_object = new Query({
        solver: "swi",
        operation: "sat"
      });
      const result = await runQuery(
        this,
        "https://app.variamos.com/semantic_translator",
        query_object
      );
      appModel.inconsistent = !result;
      this.raiseEventUpdateProject(this._project, domainModel.id);
      if (result) {
        alertify.success(`${appModel.name} is consistent with the domain model.`, 0);
        appModel.consistencyError = null;
      } else {
        const errorMessage = `${appModel.name} is not consistent with the domain model.`;
        appModel.consistencyError = errorMessage;
        alertify.error(errorMessage, 0);
      }
    })
    domainModel.elements = JSON.parse(domainElementsBackup);
  }

  checkConsistency(model: Model) {
    if (model.type === 'Application feature tree')
      this.solveConsistency(model);
    else {
      this.resetConfiguration(model);
      this.solveConsistencyForAll(model);
    }
  }
  async drawCoreFeatureTree() {
     const query_object = new Query({
      "solver": "minizinc",
      "operation": "sat",
      "iterate_over": [
        {
          "model_object": "element",
          "object_type": [
            "ConcreteFeature",
            "RootFeature",
            "AbstractFeature"
          ],
          "with_value": 0
        }
      ]
    });
    const result = await runQuery(
      this,
      "https://app.variamos.com/semantic_translator",
      query_object,
    );
    const formattedResults = result.map((elem) => [
      elem[0].replace("UUID_", "").replaceAll("_", "-"),
      elem[1]])
    formattedResults.forEach(elem => {
      let esdelcore = !elem[1];
      const element = this.findModelElementByIdInProject(elem[0]);
      const property = new Property('Core', esdelcore, "Boolean", null, null, null, false, false, null, null, null, null, null, null, null);
      element.properties.push(property);
      console.log(element.properties);
    });
    this.raiseEventUpdateProject(this._project, this.getTreeIdItemSelected());
  }
}