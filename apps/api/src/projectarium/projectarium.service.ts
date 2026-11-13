import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ProjectariumEngine,
  ProjectariumEvent,
  ProjectariumProject,
  ProjectariumRegisterPayload,
  ProjectariumRegisterResponse,
  ProjectariumTodoItem,
  ProjectShieldStats,
} from '@lemon/projectarium';
import {
  AddAppToProjectDto,
  AddChronicleEventDto,
  AddProjectTodoDto,
  ProjectariumRegisterDto,
} from './projectarium.dto';

@Injectable()
export class ProjectariumService {
  private readonly engine: ProjectariumEngine;

  constructor() {
    this.engine = new ProjectariumEngine();
  }

  registerOrAttach(dto: ProjectariumRegisterDto): ProjectariumRegisterResponse {
    return this.engine.registerOrAttach({
      projectSlug: dto.projectSlug,
      projectName: dto.projectName,
      projectToken: dto.projectToken,
      appName: dto.appName,
      preferredPort: dto.preferredPort,
      environment: dto.environment,
      networkMode: dto.networkMode,
      healthUrl: dto.healthUrl,
      context: dto.context,
      initialTodos: dto.initialTodos,
      author: dto.author,
    });
  }

  listProjects(): ProjectariumProject[] {
    return this.engine.listProjects();
  }

  getProject(query: string): ProjectariumProject {
    const project = this.engine.getProject(query);
    if (!project) {
      throw new NotFoundException(`Project stand '${query}' not found`);
    }
    return project;
  }

  addAppToProject(slugOrToken: string, dto: AddAppToProjectDto) {
    const project = this.getProject(slugOrToken);
    return this.engine.registerOrAttach({
      projectToken: project.projectToken,
      appName: dto.appName,
      preferredPort: dto.preferredPort,
      environment: dto.environment,
      networkMode: dto.networkMode,
      healthUrl: dto.healthUrl,
      author: dto.author,
    });
  }

  releaseApp(slugOrToken: string, instanceId: string, author?: string): { success: boolean } {
    const success = this.engine.releaseApp(slugOrToken, instanceId, author);
    if (!success) {
      throw new NotFoundException(`App instance '${instanceId}' not found in project '${slugOrToken}'`);
    }
    return { success: true };
  }

  simulateFailure(slugOrToken: string, instanceId: string) {
    const result = this.engine.simulateFailure(slugOrToken, instanceId);
    if (!result.app) {
      throw new NotFoundException(`App instance '${instanceId}' not found in project '${slugOrToken}'`);
    }
    return result;
  }

  heartbeat(slugOrToken: string, instanceId: string, latencyMs?: number) {
    const success = this.engine.heartbeat(slugOrToken, instanceId, latencyMs);
    if (!success) {
      throw new NotFoundException(`App instance '${instanceId}' not found in project '${slugOrToken}'`);
    }
    return { success: true, status: 'ONLINE' };
  }

  addTodo(slugOrToken: string, dto: AddProjectTodoDto): ProjectariumTodoItem {
    const todo = this.engine.addTodo(slugOrToken, {
      title: dto.title,
      scope: dto.scope,
      targetAppName: dto.targetAppName,
      priority: dto.priority,
      author: dto.author,
    });
    if (!todo) {
      throw new NotFoundException(`Project stand '${slugOrToken}' not found`);
    }
    return todo;
  }

  toggleTodo(slugOrToken: string, todoId: string): ProjectariumTodoItem {
    const todo = this.engine.toggleTodo(slugOrToken, todoId);
    if (!todo) {
      throw new NotFoundException(`Todo '${todoId}' not found in project '${slugOrToken}'`);
    }
    return todo;
  }

  addChronicleEvent(slugOrToken: string, dto: AddChronicleEventDto): ProjectariumEvent {
    const event = this.engine.addChronicleEvent(slugOrToken, {
      description: dto.description,
      scope: dto.scope,
      targetAppName: dto.targetAppName,
      author: dto.author,
    });
    if (!event) {
      throw new NotFoundException(`Project stand '${slugOrToken}' not found`);
    }
    return event;
  }

  getStats(): ProjectShieldStats {
    return this.engine.getStats();
  }
}
