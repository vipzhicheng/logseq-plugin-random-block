import "@logseq/libs";
import { BlockEntity } from "@logseq/libs/dist/LSPlugin.user";
import { sampleSize } from "lodash";
const flatBlocks = (blocks: BlockEntity[]) => {
  let flat: any[] = [];
  blocks.forEach((block) => {
    if (Boolean(block.content) && block.content.indexOf("{{renderer") === -1) {
      flat.push({
        uuid: block.uuid,
      });
    }

    if (block.children) {
      flat = flat.concat(flatBlocks(block.children as BlockEntity[]));
    }
  });

  return flat;
};
async function parseRandomlyBlockByTag(keyword: string, size = 1) {
  let query = `[:find (pull ?b [*])
  :where
  [?p :block/name "${keyword.toLowerCase()}"]
  [?b :block/refs ?p]]`;

  let results = await logseq.DB.datascriptQuery(query);
  let flattenedResults = results
    .filter((item: any) => {
      return (
        Boolean(item[0].content) && item[0].content.indexOf("{{renderer") === -1
      );
    })
    .map((mappedQuery: any) => ({
      uuid: mappedQuery[0].uuid["$uuid$"],
    }));

  return sampleSize(flattenedResults, size);
}

const main = async () => {
  logseq.Editor.registerSlashCommand(
    "Random Block Based On Block",
    async () => {
      await logseq.Editor.insertAtEditingCursor(
        `{{renderer random-block, block, (()), 1}}`
      );
    }
  );

  logseq.Editor.registerSlashCommand("Random Block Based On Page", async () => {
    await logseq.Editor.insertAtEditingCursor(
      `{{renderer random-block, page, [[]], 1}}`
    );
  });

  logseq.Editor.registerSlashCommand("Random Block Based On Tag", async () => {
    await logseq.Editor.insertAtEditingCursor(
      `{{renderer random-block, tag, #, 1}}`
    );
  });

  const model = {
    async refresh(e: any) {
      const { uuid, keyword, randomType, size = 1 } = e.dataset;
      const block = await logseq.Editor.getBlock(uuid, {
        includeChildren: true,
      });

      if (block?.children && block.children.length > 0) {
        for (let child of block.children) {
          await logseq.Editor.removeBlock((child as BlockEntity).uuid);
        }
      }

      let blocks: any[] = [];
      if (randomType === "tag") {
        blocks = await parseRandomlyBlockByTag(keyword, size);
      } else if (randomType === "page") {
        const treeBlocks = await logseq.Editor.getPageBlocksTree(keyword);
        const flattedBlocks = flatBlocks(treeBlocks);
        const sampledBlocks = sampleSize(flattedBlocks, size);
        blocks = sampledBlocks;
      } else if (randomType === "block") {
        const block = await logseq.Editor.getBlock(keyword, {
          includeChildren: true,
        });
        if (block?.children) {
          const flattedBlocks = flatBlocks(block.children as BlockEntity[]);
          const sampledBlocks = sampleSize(flattedBlocks, size);
          blocks = sampledBlocks;
        }
      }

      for (let block of blocks) {
        await logseq.Editor.insertBlock(uuid, `((${block.uuid}))`, {
          before: false,
          sibling: false,
        });
      }

      setTimeout(async () => {
        await logseq.Editor.exitEditingMode(false);
      }, 300);
    },
  };
  logseq.provideModel(model);
  logseq.App.onMacroRendererSlotted(async ({ slot, payload }) => {
    let [type, randomType, keyword, size = 1] = payload.arguments;

    const keywordClean = keyword
      .replace(/^#+/, "")
      .replace(/^\(+/, "")
      .replace(/\)+$/, "")
      .replace(/^\[+/, "")
      .replace(/\]+$/, "");

    let { uuid } = payload;
    if (type === "random-block") {
      logseq.provideUI({
        key: "random-block-" + slot,
        slot,
        reset: true,
        template: `
          <strong>Random block</strong>: <a data-on-click="refresh" data-uuid="${uuid}" data-random-type="${randomType}" data-keyword="${keywordClean}" data-size="${size}"><i class="ti ti-refresh"></i></a>
        `,
      });
    }
  });
};

logseq.ready(main).catch(console.error);
