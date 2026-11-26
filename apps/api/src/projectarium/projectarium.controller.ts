import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ProjectariumEnvironment, ProjectariumNetworkMode } from '@lemon/projectarium';
import { ProjectariumService } from './projectarium.service';
import { TimelineBoardLinkDto, TimelinesSyncService } from './timelines-sync.service';
import {
  AddAppToProjectDto,
  AddChronicleEventDto,
  AddProjectNoteDto,
  AddProjectTodoDto,
  CreateProjectStandDto,
  ProjectariumHeartbeatDto,
  ProjectariumRegisterDto,
  ProjectariumReleaseDto,
  UpdateProjectNoteDto,
} from './projectarium.dto';

@Controller('projectarium')
export class ProjectariumController {
  constructor(
    private readonly projectariumService: ProjectariumService,
    private readonly timelinesSync: TimelinesSyncService,
  ) {}

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
   * Heartbeat endpoint for active instances to renew their lease token.
   */
  @Post('heartbeat')
  @HttpCode(HttpStatus.OK)
  heartbeat(@Body() dto: ProjectariumHeartbeatDto) {
    return this.projectariumService.heartbeat(dto);
  }

  /**
   * Graceful lease-authenticated release of an allocated application port.
   */
  @Post('release')
  @HttpCode(HttpStatus.OK)
  releaseByLease(@Body() dto: ProjectariumReleaseDto) {
    return this.projectariumService.releaseByLease(dto);
  }

  /**
   * Flat pool view across all stands with optional environment/networkMode/machineId filters.
   */
  @Get('pool')
  getPool(
    @Query('environment') environment?: ProjectariumEnvironment,
    @Query('networkMode') networkMode?: ProjectariumNetworkMode,
    @Query('machineId') machineId?: string,
    @Query('includeEvicted') includeEvicted?: string,
  ) {
    return this.projectariumService.getPool(environment, networkMode, machineId, includeEvicted === 'true');
  }

  /**
   * Localhost apps scoped strictly to the specified workstation machineId.
   */
  @Get('local')
  getLocalApps(@Query('machineId') machineId?: string) {
    return this.projectariumService.getLocalApps(machineId);
  }

  /**
   * List known workstations and cluster hosts registered in Projectarium.
   */
  @Get('machines')
  getMachines() {
    return this.projectariumService.getMachines();
  }

  /**
   * Persistent run analytics broken down by workstation (PC-1, PC-2, Prod) and top apps.
   */
  @Get('analytics')
  getAnalytics(@Query('days') days?: string) {
    const parsedDays = days ? Number(days) : 30;
    return this.projectariumService.getAnalytics(Number.isFinite(parsedDays) ? parsedDays : 30);
  }

  /**
   * List project stands filtered for viewer:
   * - Always includes public/shared URLs.
   * - Includes localhost apps only when matching machineId (or includeAllLocal=true).
   */
  @Get('projects')
  listProjects(
    @Query('machineId') machineId?: string,
    @Query('includeAllLocal') includeAllLocal?: string,
  ) {
    return this.projectariumService.listProjects({
      machineId,
      includeAllLocal: includeAllLocal === 'true',
    });
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
   * List all registered Lemon Core project shards (with attached analytics if available)
   */
  @Get('shards')
  listShards(@Query('includeEvicted') includeEvicted?: string) {
    return this.projectariumService.listShards(includeEvicted === 'true');
  }

  /**
   * Resolve the active Core Shard endpoint for a projectSlug (falls back to Main Shard shared-logical)
   */
  @Get('shards/resolve')
  resolveShard(
    @Query('projectSlug') projectSlug = 'lemon-core',
    @Query('fallbackBaseUrl') fallbackBaseUrl?: string,
  ) {
    return this.projectariumService.resolveShard(projectSlug, fallbackBaseUrl);
  }

  /**
   * Aggregated cross-shard telemetry collected via durable JetStream consumer
   */
  @Get('shards/analytics')
  getShardAnalytics(@Query('projectSlug') projectSlug?: string) {
    return this.projectariumService.getShardAnalytics(projectSlug);
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

  /**
   * List linked TimeLine boards for a Projectarium stand
   */
  @Get('projects/:slugOrToken/timelines')
  listTimelineLinks(@Param('slugOrToken') slugOrToken: string) {
    return this.timelinesSync.listLinks(slugOrToken);
  }

  /**
   * Link a TimeLine board to a Projectarium stand
   */
  @Post('projects/:slugOrToken/timelines')
  upsertTimelineLink(
    @Param('slugOrToken') slugOrToken: string,
    @Body() dto: TimelineBoardLinkDto,
  ) {
    return this.timelinesSync.upsertLink(slugOrToken, dto);
  }

  /**
   * Unlink a TimeLine board from a Projectarium stand
   */
  @Delete('projects/:slugOrToken/timelines/:boardId')
  removeTimelineLink(
    @Param('slugOrToken') slugOrToken: string,
    @Param('boardId') boardId: string,
  ) {
    return this.timelinesSync.removeLink(slugOrToken, boardId);
  }

  /**
   * Trigger manual bidirectional sync with linked TimeLine boards
   */
  @Post('projects/:slugOrToken/timelines/sync')
  syncTimelineLinks(@Param('slugOrToken') slugOrToken: string) {
    return this.timelinesSync.syncStand(slugOrToken);
  }
}
