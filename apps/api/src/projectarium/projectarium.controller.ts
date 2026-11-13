import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ProjectariumService } from './projectarium.service';
import {
  AddAppToProjectDto,
  AddChronicleEventDto,
  AddProjectTodoDto,
  ProjectariumRegisterDto,
} from './projectarium.dto';

@Controller('projectarium')
export class ProjectariumController {
  constructor(private readonly projectariumService: ProjectariumService) {}

  /**
   * Unified Smart Handler ("Upsert on First Touch")
   * If project does not exist -> creates it, generates projectToken, and attaches first app.
   * If project exists -> attaches application under the existing project.
   */
  @Post('register')
  register(@Body() dto: ProjectariumRegisterDto) {
    return this.projectariumService.registerOrAttach(dto);
  }

  /**
   * List all project stands
   */
  @Get('projects')
  listProjects() {
    return this.projectariumService.listProjects();
  }

  /**
   * Overall Port Shield stats for HUD
   */
  @Get('stats')
  getStats() {
    return this.projectariumService.getStats();
  }

  /**
   * Get single project stand
   */
  @Get('projects/:slugOrToken')
  getProject(@Param('slugOrToken') slugOrToken: string) {
    return this.projectariumService.getProject(slugOrToken);
  }

  /**
   * Add application to project stand
   */
  @Post('projects/:slugOrToken/apps')
  addApp(
    @Param('slugOrToken') slugOrToken: string,
    @Body() dto: AddAppToProjectDto
  ) {
    return this.projectariumService.addAppToProject(slugOrToken, dto);
  }

  /**
   * Release application from project stand
   */
  @Delete('projects/:slugOrToken/apps/:instanceId')
  releaseApp(
    @Param('slugOrToken') slugOrToken: string,
    @Param('instanceId') instanceId: string
  ) {
    return this.projectariumService.releaseApp(slugOrToken, instanceId);
  }

  /**
   * Simulate failure (Circuit Breaker demo)
   */
  @Post('projects/:slugOrToken/apps/:instanceId/simulate-failure')
  simulateFailure(
    @Param('slugOrToken') slugOrToken: string,
    @Param('instanceId') instanceId: string
  ) {
    return this.projectariumService.simulateFailure(slugOrToken, instanceId);
  }

  /**
   * Heartbeat recovery
   */
  @Post('projects/:slugOrToken/apps/:instanceId/heartbeat')
  heartbeat(
    @Param('slugOrToken') slugOrToken: string,
    @Param('instanceId') instanceId: string
  ) {
    return this.projectariumService.heartbeat(slugOrToken, instanceId);
  }

  /**
   * Add Todo item
   */
  @Post('projects/:slugOrToken/todos')
  addTodo(
    @Param('slugOrToken') slugOrToken: string,
    @Body() dto: AddProjectTodoDto
  ) {
    return this.projectariumService.addTodo(slugOrToken, dto);
  }

  /**
   * Toggle Todo item
   */
  @Patch('projects/:slugOrToken/todos/:todoId/toggle')
  toggleTodo(
    @Param('slugOrToken') slugOrToken: string,
    @Param('todoId') todoId: string
  ) {
    return this.projectariumService.toggleTodo(slugOrToken, todoId);
  }

  /**
   * Add Chronicle Event
   */
  @Post('projects/:slugOrToken/events')
  addEvent(
    @Param('slugOrToken') slugOrToken: string,
    @Body() dto: AddChronicleEventDto
  ) {
    return this.projectariumService.addChronicleEvent(slugOrToken, dto);
  }
}
