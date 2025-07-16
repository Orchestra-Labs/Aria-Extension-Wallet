import { render, screen } from '@testing-library/react';

function HelloWorld() {
  return <h1>Hello, world!</h1>;
}

test('renders HelloWorld component', () => {
  render(<HelloWorld />);
  expect(screen.getByText('Hello, world!')).toBeInTheDocument();
});
