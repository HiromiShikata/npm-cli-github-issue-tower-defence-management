# Test Guidelines

## 1. Basic Structure

### Test Organization

```typescript
describe('UseCaseName', () => {
  describe('run', () => {
    it('should do something', () => {
      // test content
    });
  });
});
```

### Test Setup

- Set timeout if usecase requires async operations
- Define reusable mock objects at the top of the test file
- Use `beforeEach` for common setup and mock clearing

## 2. Mock Objects

### Creating Basic Mocks

```typescript
// Repository mocks
const mockRepository = mock<RepositoryInterface>();

// Entity mocks
const mockEntity = mock<EntityType>();
mockEntity.property = value;
```

### Complex Object Construction

```typescript
// WRONG - Direct object creation
const wrongObject = {
  status: {
    name: 'test',
    statuses: [],
  },
};

// WRONG - Partial mock with type assertion
const wrongMock = {
  ...mock<Type>(),
  statuses: [] as Status[],
};

// CORRECT - Full mock construction
const mockStatus = mock<Project['status']>();
mockStatus.name = 'Status';
mockStatus.fieldId = 'field1';
mockStatus.statuses = [];

const mockProject = mock<Project>();
mockProject.status = mockStatus;
```

### Nested Object Construction

```typescript
// WRONG - Mixed direct creation and mocks
const wrongNested = {
  ...mock<Parent>(),
  child: {
    property: 'value',
  },
};

// CORRECT - Fully mocked structure
const mockChild = mock<ChildType>();
mockChild.property = 'value';

const mockParent = mock<ParentType>();
mockParent.child = mockChild;
```

### Array Properties

```typescript
// WRONG - Direct empty array
const wrongArray = [];
const alsoWrong = [] as Type[];

// CORRECT - Properly typed mock array
const mockItem = mock<ItemType>();
mockItem.property = 'value';
const correctArray = [mockItem];

// CORRECT - Empty array with mock type
const mockStatus = mock<Project['status']>();
mockStatus.statuses = [];
```

## 3. Test Cases

### Structure

```typescript
const testCases: {
  name: string;
  input: {
    // Fully typed input properties
  };
  expectedCalls: {
    // Fully typed expected results
  };
}[] = [
  {
    name: 'descriptive test name',
    input: {
      project: mockProject,
      // other inputs...
    },
    expectedCalls: {
      methodName: [[param1, param2]],
    },
  },
];
```

### Execution

```typescript
testCases.forEach(({ name, input, expectedCalls }) => {
  it(name, async () => {
    // Clear mocks before each test case
    jest.clearAllMocks();

    // Execute test
    await useCase.run(input);

    // Verify all expected calls
    expect(mockRepository.method.mock.calls).toEqual(expectedCalls.methodName);
  });
});
```

## 4. Strict Rules

### Forbidden Practices

- Type assertions (`as`)
- Using `any` type
- Non-null assertions (`!`)
- Comments within test cases
- Non-English text
- Direct object creation without mocks
- Partial mock objects
- Type casting
- Mixing direct creation with mocks

### Required Practices

- Full mock creation for all objects
- Explicit type definitions
- Separate mock creation for nested objects
- Clear mock setup before each test
- Verification of all mock calls
- Error case testing
- Complete type coverage

## 5. Error Testing

### Structure

```typescript
it('should throw specific error', async () => {
  const mockErrorCase = mock<InputType>();
  // Setup error condition...

  await expect(useCase.run(mockErrorCase)).rejects.toThrow(
    'Expected error message',
  );
});
```

## 6. Mock Implementation

### Dynamic Returns

```typescript
// Counter implementation
let counter = 1;
mockRepository.method.mockImplementation(() => counter++);

// Conditional returns
mockRepository.method.mockImplementation((input) => {
  if (condition) {
    return valueA;
  }
  return valueB;
});
```

## 7. Verification

### Call Verification

```typescript
expect(mockRepository.method.mock.calls).toEqual([
  [param1, param2],
  [param3, param4],
]);

expect(mockRepository.method).toHaveBeenCalledWith(
  expect.objectContaining({
    property: value,
  }),
);
```

### State Verification

```typescript
expect(result).toEqual(
  expect.objectContaining({
    property: expectedValue,
  }),
);
```

## 8. Test Data Management

### Base Objects

```typescript
const baseMockProject = mock<Project>();
const baseMockIssue = mock<Issue>();

// Extend base objects
const testProject = {
  ...baseMockProject,
  status: mockStatus,
};
```

### Common Setup

```typescript
beforeEach(() => {
  jest.clearAllMocks();

  // Reset base mocks
  baseMockProject.property = defaultValue;

  // Setup common mock implementations
  mockRepository.method.mockResolvedValue(defaultValue);
});
```
