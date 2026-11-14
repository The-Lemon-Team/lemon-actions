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
  AddProjectNoteDto,
  AddProjectTodoDto,
  CreateProjectStandDto,
  ProjectariumRegisterDto,
  UpdateProjectNoteDto,
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
   * Create a project stand without an initial app
   */
  @Post('projects')
  createProject(@Body() dto: CreateProjectStandDto) {
    return this.projectariumService.createProject(dto);
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
   * Delete a project stand
   */
  @Delete('projects/:slugOrToken')
  deleteProject(@Param('slugOrToken') slugOrToken: string) {
    return this.projectariumService.deleteProject(slugOrToken);
  }

  /**
   * Active healthcheck round for all apps in a project stand (HTTP + TCP)
   */
  @Post('projects/:slugOrToken/ping')
  pingStand(@Param('slugOrToken') slugOrToken: string) {
    return this.projectariumService.pingStand(slugOrToken, { recordSummary: true });
  }

  /**
   * Active healthcheck for a single app instance in a project stand
   */
  @Post('projects/:slugOrToken/apps/:instanceId/ping')
  pingApp(
    @Param('slugOrToken') slugOrToken: string,
    @Param('instanceId') instanceId: string
  ) {
    return this.projectariumService.pingApp(slugOrToken, instanceId);
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
   * Add Note item
   */
  @Post('projects/:slugOrToken/notes')
  addNote(
    @Param('slugOrToken') slugOrToken: string,
    @Body() dto: AddProjectNoteDto
  ) {
    return this.projectariumService.addNote(slugOrToken, dto);
  }

  /**
   * Update Note item
   */
  @Patch('projects/:slugOrToken/notes/:noteId')
  updateNote(
    @Param('slugOrToken') slugOrToken: string,
    @Param('noteId') noteId: string,
    @Body() dto: UpdateProjectNoteDto
  ) {
    return this.projectariumService.updateNote(slugOrToken, noteId, dto);
  }

  /**
   * Delete Note item
   */
  @Delete('projects/:slugOrToken/notes/:noteId')
  deleteNote(
    @Param('slugOrToken') slugOrToken: string,
    @Param('noteId') noteId: string
  ) {
    return this.projectariumService.deleteNote(slugOrToken, noteId);
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
