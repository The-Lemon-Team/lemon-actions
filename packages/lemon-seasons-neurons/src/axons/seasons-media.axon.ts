import {
  MediaAsset,
  MediaIngestRequest,
  MediaLifecycleAxon,
  MediaViewResolved,
} from '@lemon/media-hub-neurons';
import { SeasonsCombinatorBridge } from '../bridge/seasons-combinator-bridge';
import { extractNoteMedia } from '../client/seasons-api.client';
import {
  IngestSeasonNoteInput,
  NoteMediaAttachmentInput,
} from '../types/seasons.types';

export interface SeasonsMediaAxonOptions {
  bridge: SeasonsCombinatorBridge;
  mediaAxon: MediaLifecycleAxon;
  defaultFolderPath?: string;
}

export interface IngestNoteWithMediaInput {
  note: IngestSeasonNoteInput;
  mediaFiles?: MediaIngestRequest[];
  existingAssetIds?: string[];
  flowId?: string;
}

export interface IngestNoteWithMediaResult {
  noteId: string;
  action: 'CREATED' | 'UPDATED';
  note?: any;
  uploadedAssets: MediaAsset[];
  attachedMedia: NoteMediaAttachmentInput[];
}

/**
 * Cross-neuron Axon bridging `@lemon/media-hub-neurons` (MediaLifecycleAxon)
 * with `@lemon/seasons-neurons` (SeasonsCombinatorBridge + SeasonsApiClient).
 *
 * Allows notes ingested into Lemon Seasons to seamlessly upload, resolve ACL/signed URLs,
 * attach media assets in PostgreSQL (`NoteImage`), and mirror telemetry to Core Combinator.
 */
export class SeasonsMediaAxon {
  private readonly bridge: SeasonsCombinatorBridge;
  private readonly mediaAxon: MediaLifecycleAxon;
  private readonly defaultFolderPath: string;

  constructor(options: SeasonsMediaAxonOptions) {
    this.bridge = options.bridge;
    this.mediaAxon = options.mediaAxon;
    this.defaultFolderPath = options.defaultFolderPath || 'seasons/notes';
  }

  /**
   * Maps a Media Hub `MediaAsset` (plus optional resolved view URL) into a `NoteMediaAttachmentInput`.
   */
  toNoteAttachment(
    asset: MediaAsset,
    options?: { isMain?: boolean; caption?: string; resolvedView?: MediaViewResolved },
  ): NoteMediaAttachmentInput {
    const rawUrl = options?.resolvedView?.url || this.mediaAxon.apiClient.resolveUrl(asset.url);
    const thumbRaw = asset.thumbnailUrl
      ? this.mediaAxon.apiClient.resolveUrl(asset.thumbnailUrl)
      : rawUrl;

    return {
      url: rawUrl,
      thumbnailUrl: thumbRaw,
      filename: asset.filename || asset.originalFilename,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      width: asset.width ?? null,
      height: asset.height ?? null,
      caption: options?.caption || asset.title || asset.userPrompt || undefined,
      alt: asset.description || asset.title || asset.originalFilename,
      isMain: Boolean(options?.isMain),
      mediaAssetId: asset.id,
    };
  }

  /**
   * Uploads media files through Media Hub's `MediaIngestFlow`, resolves their URLs,
   * and ingests the Note into Lemon Seasons with all media attachments linked.
   */
  async ingestNoteWithMedia(
    input: IngestNoteWithMediaInput,
  ): Promise<IngestNoteWithMediaResult> {
    const uploadedAssets: MediaAsset[] = [];
    const attachments: NoteMediaAttachmentInput[] = [...(input.note.images || [])];

    const files = input.mediaFiles || [];
    for (let i = 0; i < files.length; i++) {
      const req = files[i];
      const ingested = await this.mediaAxon.addMedia({
        ...req,
        folderPath: req.folderPath || this.defaultFolderPath,
      });
      uploadedAssets.push(ingested.asset);

      let resolvedView: MediaViewResolved | undefined;
      try {
        resolvedView = await this.mediaAxon.viewMedia({
          assetId: ingested.asset.id,
          trackUsage: false,
        });
      } catch {
        // Fallback to direct asset URL if viewMedia fails
      }

      attachments.push(
        this.toNoteAttachment(ingested.asset, {
          isMain: i === 0 && !attachments.some((a) => a.isMain),
          resolvedView,
        }),
      );
    }

    const mediaAssetIds = Array.from(
      new Set([
        ...(input.note.mediaAssetIds || []),
        ...(input.existingAssetIds || []),
        ...uploadedAssets.map((a) => a.id),
      ]),
    );

    // If existingAssetIds were provided without image descriptors, resolve them from Media Hub
    for (const assetId of input.existingAssetIds || []) {
      if (attachments.some((a) => a.mediaAssetId === assetId)) continue;
      try {
        const view = await this.mediaAxon.viewMedia({ assetId, trackUsage: false });
        attachments.push(
          this.toNoteAttachment(view.asset, {
            isMain: attachments.length === 0,
            resolvedView: view,
          }),
        );
      } catch {
        // Backend can still resolve mediaAssetIds directly
      }
    }

    const res = await this.bridge.ingestNote(
      {
        ...input.note,
        images: attachments.length > 0 ? attachments : undefined,
        mediaAssetIds: mediaAssetIds.length > 0 ? mediaAssetIds : undefined,
      },
      input.flowId,
    );

    await this.bridge.emitChronicle('media', 'SEASONS_NOTE_MEDIA_INGESTED', {
      noteId: res.noteId,
      uploadedCount: uploadedAssets.length,
      mediaAssetIds,
      streamSlug: input.note.streamSlug || this.bridge.defaultStreamSlug,
      feedSlug: input.note.feedSlug,
    });

    return {
      noteId: res.noteId,
      action: res.action,
      note: res.note,
      uploadedAssets,
      attachedMedia: attachments,
    };
  }

  /**
   * Uploads media files to Media Hub and attaches them to an existing Note in Lemon Seasons.
   */
  async attachMediaToNote(
    noteId: string,
    mediaFiles: MediaIngestRequest[],
  ): Promise<{ uploadedAssets: MediaAsset[]; attachedMedia: NoteMediaAttachmentInput[] }> {
    const uploadedAssets: MediaAsset[] = [];
    const attachments: NoteMediaAttachmentInput[] = [];

    for (let i = 0; i < mediaFiles.length; i++) {
      const req = mediaFiles[i];
      const ingested = await this.mediaAxon.addMedia({
        ...req,
        folderPath: req.folderPath || this.defaultFolderPath,
      });
      uploadedAssets.push(ingested.asset);

      let resolvedView: MediaViewResolved | undefined;
      try {
        resolvedView = await this.mediaAxon.viewMedia({
          assetId: ingested.asset.id,
          trackUsage: false,
        });
      } catch {
        // Best-effort signed URL resolution
      }

      attachments.push(
        this.toNoteAttachment(ingested.asset, {
          isMain: i === 0,
          resolvedView,
        }),
      );
    }

    await this.bridge.seasons.attachMediaAssets(noteId, attachments);
    await this.bridge.emitChronicle('media', 'SEASONS_NOTE_MEDIA_ATTACHED', {
      noteId,
      mediaAssetIds: uploadedAssets.map((a) => a.id),
    });

    return { uploadedAssets, attachedMedia: attachments };
  }

  /**
   * Resolves ACL-aware URLs (including HMAC signed URLs for PRIVATE/SCOPED assets)
   * for any media attached to a Seasons Note.
   */
  async resolveNoteMediaUrls(note: any): Promise<NoteMediaAttachmentInput[]> {
    const mediaList = extractNoteMedia(note);
    const resolved: NoteMediaAttachmentInput[] = [];

    for (const item of mediaList) {
      if (!item.mediaAssetId) {
        resolved.push(item);
        continue;
      }

      try {
        const view = await this.mediaAxon.viewMedia({
          assetId: item.mediaAssetId,
          trackUsage: true,
          viewerContext: `seasons-note:${note?.id || 'unknown'}`,
        });
        resolved.push({
          ...item,
          url: view.url,
          thumbnailUrl: view.asset.thumbnailUrl
            ? this.mediaAxon.apiClient.resolveUrl(view.asset.thumbnailUrl)
            : view.url,
        });
      } catch {
        resolved.push(item);
      }
    }

    return resolved;
  }

  /**
   * Deletes an underlying Media Hub asset using MediaDeleteFlow.
   */
  async deleteMediaAsset(assetId: string, reason?: string) {
    return this.mediaAxon.deleteMedia({ assetId, reason });
  }
}
