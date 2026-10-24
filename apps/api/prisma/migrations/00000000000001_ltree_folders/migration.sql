-- Index for ltree subtree/ancestor queries (path <@, @>, ~)
CREATE INDEX "folders_path_gist_idx" ON "folders" USING GIST ("path");
CREATE INDEX "folders_path_btree_idx" ON "folders" USING BTREE ("path");
