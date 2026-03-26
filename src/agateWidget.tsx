import React from 'react';
import { ReactWidget } from '@jupyterlab/apputils';
import Agate from 'climb-agate-gui';

export class AgateWidget extends ReactWidget {
  constructor(
    httpPathHandler: (route: string) => Promise<Response>,
    version: string,
    name: string,
  ) {
    super();
    this.httpPathHandler = httpPathHandler;
    this.version = version;
    this.name = name;
  }

  httpPathHandler: (route: string) => Promise<Response>;
  version: string;
  name: string;

  // Set the title of the widget
  setTitle = (title: string): void => {
    this.title.label = title;
  };

  render(): JSX.Element {
    return (
      <Agate
        httpPathHandler={this.httpPathHandler}
        extVersion={this.version}
      />
    );
  }
}
