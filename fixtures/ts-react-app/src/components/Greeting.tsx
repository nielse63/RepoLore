import { Component } from "react";

export interface GreetingProps {
  label: string;
}

export class Greeting extends Component<GreetingProps> {
  render() {
    return <p>{this.props.label}</p>;
  }
}
