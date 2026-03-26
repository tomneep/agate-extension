import {
  ILayoutRestorer,
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import {
  ICommandPalette,
  MainAreaWidget,
  WidgetTracker
  // showDialog,
  // Dialog
} from '@jupyterlab/apputils';
import { IStateDB } from '@jupyterlab/statedb';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { HTMLViewer, IHTMLViewerTracker } from '@jupyterlab/htmlviewer';
import { ILauncher } from '@jupyterlab/launcher';
import { requestAPI, requestAPIResponse } from './handler';
import { AgateWidget } from './agateWidget';
import { dnaIcon } from './icon';

export const PLUGIN_NAMESPACE = '@climb-agate-gui-extension';
const PLUGIN_ID = `${PLUGIN_NAMESPACE}:plugin`;

/**
 * Initialization data for the climb-agate-gui extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: PLUGIN_ID,
  description: 'JupyterLab extension for the Agate Graphical User Interface',
  autoStart: true,
  requires: [ICommandPalette, IDocumentManager, IStateDB],
  optional: [ILauncher, ILayoutRestorer, IHTMLViewerTracker],
  activate: (
    app: JupyterFrontEnd,
    palette: ICommandPalette,
    documentManager: IDocumentManager,
    stateDB: IStateDB,
    launcher: ILauncher | null,
    restorer: ILayoutRestorer | null,
    htmlTracker: IHTMLViewerTracker | null
  ) => {
    console.log('JupyterLab extension @climb-agate-gui is activated!');

    // Define command IDs and categories
    const agateCommandID = 'agate_extension';
    const category = 'CLIMB-TRE';

    // Retrieve extension version and log to the console
    let version = '';
    requestAPI<any>('version')
      .then(data => {
        version = data['version'];
        console.log(
          `JupyterLab extension @climb-agate-gui version: ${version}`
        );
      })
      .catch(error =>
        console.error(`Failed to fetch @climb-agate-gui version: ${error}`)
      );

    // Handler for rerouting requests to the Agate API
    const httpPathHandler = async (route: string): Promise<Response> => {
      return requestAPIResponse('reroute', {}, ['route', route]);
    };

    // Handle layout restoration
    if (restorer) {
      void restorer.restore(tracker, {
        command: agateCommandID,
        args: widget => ({ name: widget.content.name }),
        name: widget => widget.content.name
      });
    }

    // Function to create new Agate widgets
    const createAgateWidget = async (
      name?: string
    ): Promise<MainAreaWidget<AgateWidget>> => {
      // Generate a unique name if not provided
      if (!name) {
        name = Date.now().toString();
      }

      // Prefix shared by all state keys for this widget
      const stateKeyPrefix = `${PLUGIN_ID}:${name}`;

      // Load any initial state before widget creation
      const initialState = new Map<string, any>();
      const pluginStateKeys = await stateDB.list(PLUGIN_NAMESPACE);

      pluginStateKeys.ids.forEach((stateKey, index) => {
        if (stateKey.startsWith(stateKeyPrefix)) {
          initialState.set(stateKey, pluginStateKeys.values[index]);
        }
      });

      // Create the AgateWidget instance
      const content = new AgateWidget(httpPathHandler, version, name);

      // Add class for the widget
      content.addClass('agate-Widget');

      // Define the MainAreaWidget with the AgateWidget content
      const widget = new MainAreaWidget({ content });
      widget.id = `agate-widget-${name}`;
      widget.title.label = 'Agate';
      widget.title.icon = dnaIcon;
      widget.title.closable = true;

      return widget;
    };

    // Command to launch the Agate GUI
    app.commands.addCommand(agateCommandID, {
      label: 'Agate',
      caption: 'Agate | API for Pathogen Metadata',
      icon: dnaIcon,
      execute: async args => {
        const name = args['name'] as string;
        let widget: MainAreaWidget<AgateWidget>;

        if (name) {
          // Restore existing widget
          const existingWidget = tracker.find(w => w.content.name === name);
          if (existingWidget) {
            widget = existingWidget;
          } else {
            widget = await createAgateWidget(name);
          }
        } else {
          // Create new widget
          widget = await createAgateWidget();
        }

        // Add the widget to the tracker if it's not there
        if (!tracker.has(widget)) {
          tracker.add(widget);
        }

        // Attach the widget to the main work area if it's not there
        if (!widget.isAttached) {
          app.shell.add(widget, 'main');
        }

        // Activate and return the widget
        app.shell.activateById(widget.id);
        return widget;
      }
    });

    // Add commands to the command palette
    palette.addItem({ command: agateCommandID, category: category });

    // Add commands to the launcher
    if (launcher) {
      launcher.add({
        command: agateCommandID,
        category: category
      });
    }

    if (htmlTracker) {
      htmlTracker.widgetAdded.connect((sender, panel: HTMLViewer) => {
        panel.trusted = true;
      });
    }
  }
};

const tracker = new WidgetTracker<MainAreaWidget<AgateWidget>>({
  namespace: 'climb-agate-gui'
});

export default plugin;
